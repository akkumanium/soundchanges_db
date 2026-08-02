import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  examples,
  lineageNodes,
  revisionEvents,
  slugAliases,
  soundChanges,
  soundChangeSources,
  sources,
  transitionSources,
  transitions,
} from "@/db/schema";
import { type ProposalOperation } from "./proposals";
import { wouldCreateCycle } from "./tree";
import { migrateBypassedTransitionRules } from "./transition-migration";

type Event = { type: string; id: string; action: string; before: unknown; after: unknown };

/** Applies validated catalog operations immediately from the protected moderator editor. */
export async function applyModeratorOperations(operations: ProposalOperation[], moderatorId: string, summary: string, requiresReview = true) {
  if (operations.length === 0) throw new Error("Add at least one edit operation.");
  if (operations.some((operation) => operation.type === "editorial_request")) throw new Error("Editorial requests are not valid direct edits.");

  return db.transaction(async (tx) => {
    const conflict = await findConflict(tx, operations);
    if (conflict) throw new Error(conflict);
    const events: Event[] = [];
    for (const operation of operations) {
      if (operation.type !== "editorial_request") events.push(...await applyOperation(tx, operation, requiresReview ? moderatorId : null, !requiresReview));
    }
    for (const event of events) {
      await tx.insert(revisionEvents).values({
        moderatorId,
        entityType: event.type,
        entityId: event.id,
        action: event.action,
        summary,
        beforeSnapshot: event.before,
        afterSnapshot: event.after,
      });
    }
    return events;
  });
}

async function findConflict(tx: Transaction, operations: ProposalOperation[]): Promise<string | null> {
  for (const operation of operations) {
    if (!("baseRevision" in operation)) continue;
    const table = operation.type.includes("lineage") ? lineageNodes : operation.type.includes("transition") ? transitions : operation.type.includes("rule") ? soundChanges : examples;
    const [current] = await tx.select({ revision: table.revision }).from(table).where(eq(table.id, operation.id)).limit(1);
    if (!current) return `The ${operation.type.replaceAll("_", " ")} target no longer exists.`;
    if (current.revision !== operation.baseRevision) return `The target changed after this proposal was submitted (expected revision ${operation.baseRevision}, found ${current.revision}).`;
  }
  return null;
}

async function applyOperation(tx: Transaction, operation: Exclude<ProposalOperation, { type: "editorial_request" }>, submittedBy: string | null, canDeleteApproved: boolean): Promise<Event[]> {
  if (operation.type === "create_lineage") {
    if (operation.data.parentId) await assertNodeExists(tx, operation.data.parentId);
    const [after] = await tx.insert(lineageNodes).values({ ...operation.data, parentId: operation.data.parentId || null, aliases: [], approvalStatus: submittedBy ? "pending" : "approved", submittedBy }).returning();
    return [event("lineage", after.id, "create", null, after)];
  }
  if (operation.type === "update_lineage") {
    const [before] = await tx.select().from(lineageNodes).where(eq(lineageNodes.id, operation.id)).limit(1);
    const allNodes = await tx.select({ id: lineageNodes.id, parentId: lineageNodes.parentId }).from(lineageNodes);
    const parentId = operation.data.parentId || null;
    if (wouldCreateCycle(allNodes, operation.id, parentId)) throw new Error("This move would create a lineage cycle.");
    if (before.slug !== operation.data.slug) await tx.insert(slugAliases).values({ entityType: "lineage", entityId: before.id, oldSlug: before.slug }).onConflictDoNothing();
    const [after] = await tx.update(lineageNodes).set({ ...operation.data, parentId, revision: sql`${lineageNodes.revision} + 1`, updatedAt: new Date() }).where(eq(lineageNodes.id, operation.id)).returning();
    return [event("lineage", after.id, "update", before, after)];
  }
  if (operation.type === "delete_lineage") {
    const [before] = await tx.select().from(lineageNodes).where(eq(lineageNodes.id, operation.id)).limit(1);
    if (!canDeleteApproved && before.approvalStatus !== "pending") throw new Error("Only administrators can delete approved languages or stages.");
    await tx.delete(lineageNodes).where(eq(lineageNodes.id, operation.id));
    return [event("lineage", before.id, "delete", before, null)];
  }
  if (operation.type === "create_transition") {
    const data = operation.data;
    const [entry] = await tx.insert(transitions).values({ title: data.title, slug: data.slug, sourceNodeId: data.sourceNodeId, targetNodeId: data.targetNodeId, chronology: data.chronology, summary: data.summary, notes: data.notes }).returning();
    const [rule] = await tx.insert(soundChanges).values({ transitionId: entry.id, ...data.rule, approvalStatus: submittedBy ? "pending" : "approved", submittedBy }).returning();
    if (data.source?.displayCitation) {
      const [source] = await tx.insert(sources).values({ displayCitation: data.source.displayCitation, url: data.source.url, doi: data.source.doi }).returning();
      await tx.insert(transitionSources).values({ transitionId: entry.id, sourceId: source.id });
    }
    if (data.example) await tx.insert(examples).values({ soundChangeId: rule.id, ...data.example });
    const migrated = await migrateBypassedTransitionRules(tx, entry.id, entry.sourceNodeId, entry.targetNodeId);
    return [event("transition", entry.id, "create", null, { ...entry, rule: data.rule, source: data.source, example: data.example, migratedFromTransitionIds: migrated.fromTransitionIds, migratedRuleCount: migrated.ruleCount })];
  }
  if (operation.type === "update_transition") {
    const [before] = await tx.select().from(transitions).where(eq(transitions.id, operation.id)).limit(1);
    if (before.slug !== operation.data.slug) await tx.insert(slugAliases).values({ entityType: "transition", entityId: before.id, oldSlug: before.slug }).onConflictDoNothing();
    const [after] = await tx.update(transitions).set({ ...operation.data, revision: sql`${transitions.revision} + 1`, updatedAt: new Date() }).where(eq(transitions.id, operation.id)).returning();
    const migrated = await migrateBypassedTransitionRules(tx, after.id, after.sourceNodeId, after.targetNodeId);
    return [event("transition", after.id, "update", before, { ...after, migratedFromTransitionIds: migrated.fromTransitionIds, migratedRuleCount: migrated.ruleCount })];
  }
  if (operation.type === "delete_transition") {
    const [before] = await tx.select().from(transitions).where(eq(transitions.id, operation.id)).limit(1);
    if (!canDeleteApproved) {
      const [nodes, rules] = await Promise.all([tx.select().from(lineageNodes), tx.select().from(soundChanges).where(eq(soundChanges.transitionId, operation.id))]);
      const hasPendingLanguage = [before.sourceNodeId, before.targetNodeId].some((id) => nodes.find((node) => node.id === id)?.approvalStatus === "pending");
      if (!hasPendingLanguage || rules.some((rule) => rule.approvalStatus !== "pending")) throw new Error("Only administrators can delete approved language pairs or pairs containing approved sound changes.");
    }
    await tx.delete(transitions).where(eq(transitions.id, operation.id));
    return [event("transition", before.id, "delete", before, null)];
  }
  if (operation.type === "create_rule") {
    const [after] = await tx.insert(soundChanges).values({ transitionId: operation.transitionId, ...operation.data, approvalStatus: submittedBy ? "pending" : "approved", submittedBy }).returning();
    return [event("rule", after.id, "create", null, after)];
  }
  if (operation.type === "update_rule") {
    const [before] = await tx.select().from(soundChanges).where(eq(soundChanges.id, operation.id)).limit(1);
    const [after] = await tx.update(soundChanges).set({ ...operation.data, revision: sql`${soundChanges.revision} + 1`, updatedAt: new Date() }).where(eq(soundChanges.id, operation.id)).returning();
    return [event("rule", after.id, "update", before, after)];
  }
  if (operation.type === "delete_rule") {
    const [before] = await tx.select().from(soundChanges).where(eq(soundChanges.id, operation.id)).limit(1);
    if (!canDeleteApproved && before.approvalStatus !== "pending") throw new Error("Only administrators can delete approved sound changes.");
    await tx.delete(soundChanges).where(eq(soundChanges.id, operation.id));
    return [event("rule", before.id, "delete", before, null)];
  }
  if (operation.type === "create_example") {
    const [after] = await tx.insert(examples).values({ soundChangeId: operation.soundChangeId, ...operation.data }).returning();
    return [event("example", after.id, "create", null, after)];
  }
  if (operation.type === "update_example") {
    const [before] = await tx.select().from(examples).where(eq(examples.id, operation.id)).limit(1);
    const [after] = await tx.update(examples).set({ ...operation.data, revision: sql`${examples.revision} + 1`, updatedAt: new Date() }).where(eq(examples.id, operation.id)).returning();
    return [event("example", after.id, "update", before, after)];
  }
  if (operation.type === "delete_example") {
    if (!canDeleteApproved) throw new Error("Only administrators can delete approved examples.");
    const [before] = await tx.select().from(examples).where(eq(examples.id, operation.id)).limit(1);
    await tx.delete(examples).where(eq(examples.id, operation.id));
    return [event("example", before.id, "delete", before, null)];
  }
  if (operation.type === "create_source") {
    const [after] = await tx.insert(sources).values({ displayCitation: operation.data.displayCitation, url: operation.data.url, doi: operation.data.doi }).returning();
    if (operation.targetType === "transition") await tx.insert(transitionSources).values({ transitionId: operation.targetId, sourceId: after.id });
    else await tx.insert(soundChangeSources).values({ soundChangeId: operation.targetId, sourceId: after.id });
    return [event("source", after.id, "create", null, after)];
  }
  return [];
}

async function assertNodeExists(tx: Transaction, id: string) {
  const [node] = await tx.select({ id: lineageNodes.id }).from(lineageNodes).where(eq(lineageNodes.id, id)).limit(1);
  if (!node) throw new Error("The proposed parent no longer exists.");
}

function event(type: string, id: string, action: string, before: unknown, after: unknown): Event { return { type, id, action, before, after }; }
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
