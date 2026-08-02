import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { lineageNodes, soundChanges, transitionSources, transitions } from "@/db/schema";
import { bypassedTransitionIds } from "./tree";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Move rules and their pair-level citations when a nearer lineage edge replaces ancestor shortcuts. */
export async function migrateBypassedTransitionRules(tx: Transaction, destinationTransitionId: string, sourceId: string, targetId: string) {
  const [nodes, pairs] = await Promise.all([tx.select().from(lineageNodes), tx.select().from(transitions)]);
  const fromTransitionIds = bypassedTransitionIds(nodes, pairs, sourceId, targetId, destinationTransitionId);
  if (fromTransitionIds.length === 0) return { fromTransitionIds, ruleCount: 0 };

  const movedRules = await tx.update(soundChanges)
    .set({ transitionId: destinationTransitionId, revision: sql`${soundChanges.revision} + 1`, updatedAt: new Date() })
    .where(inArray(soundChanges.transitionId, fromTransitionIds))
    .returning({ id: soundChanges.id });
  const oldSourceLinks = await tx.select({ sourceId: transitionSources.sourceId })
    .from(transitionSources)
    .where(inArray(transitionSources.transitionId, fromTransitionIds));
  const sourceIds = [...new Set(oldSourceLinks.map(({ sourceId }) => sourceId))];
  if (sourceIds.length) {
    await tx.insert(transitionSources)
      .values(sourceIds.map((sourceId) => ({ transitionId: destinationTransitionId, sourceId })))
      .onConflictDoNothing();
  }
  await tx.delete(transitionSources).where(inArray(transitionSources.transitionId, fromTransitionIds));
  await tx.update(transitions)
    .set({ revision: sql`${transitions.revision} + 1`, updatedAt: new Date() })
    .where(inArray(transitions.id, fromTransitionIds));

  // Multiple old shortcuts can contain the same sort positions. Normalize the
  // merged result so subsequent editing and rendering remain deterministic.
  const orderedRules = await tx.select({ id: soundChanges.id })
    .from(soundChanges)
    .where(eq(soundChanges.transitionId, destinationTransitionId))
    .orderBy(asc(soundChanges.sortOrder), asc(soundChanges.createdAt), asc(soundChanges.id));
  for (const [sortOrder, rule] of orderedRules.entries()) {
    await tx.update(soundChanges).set({ sortOrder }).where(eq(soundChanges.id, rule.id));
  }
  return { fromTransitionIds, ruleCount: movedRules.length };
}
