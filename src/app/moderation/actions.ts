"use server";

import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { revalidateCatalog } from "@/db/queries";
import { catalogChanges, catalogChangeVerifications, examples, lineageNodes, moderators, soundChanges, sources, transitionSources, transitions } from "@/db/schema";
import { applyModeratorOperations } from "@/lib/apply-proposal";
import { authenticate, createSession, destroySession, passwordHash, requireModerator } from "@/lib/auth";
import { parseOperations } from "@/lib/proposals";
import { checkRateLimit } from "@/lib/rate-limit";
import { composeRule, slugify } from "@/lib/domain";
import { migrateBypassedTransitionRules } from "@/lib/transition-migration";
import { auditedCatalogMutation, revertCatalogChange, type CatalogTransaction } from "@/lib/catalog-audit";

export type LoginState = { error: string };

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  try {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "local";
    const rate = await checkRateLimit(ip, "moderator-login", 12, 15);
    if (!rate.allowed) return { error: "Too many sign-in attempts. Try again later." };
    const moderator = await authenticate(username, password);
    if (!moderator) return { error: "Invalid username or password." };
    await createSession(moderator.id);
  } catch {
    return { error: "The moderation database is unavailable." };
  }
  redirect("/moderation");
}

export async function logoutAction() {
  await destroySession();
  redirect("/moderation/login");
}


export async function directEditAction(formData: FormData) {
  const moderator = await requireModerator();
  const summary = String(formData.get("summary") ?? "").trim().normalize("NFC").slice(0, 240);
  const raw = String(formData.get("operations") ?? "");
  if (!summary) throw new Error("Enter a concise description for the revision history.");
  let operations;
  try {
    operations = parseOperations(JSON.parse(raw));
  } catch {
    throw new Error("The edit must be valid JSON matching a supported operation.");
  }
  await applyModeratorOperations(operations, moderator.id, summary);
  revalidateCatalog();
  revalidatePath("/"); revalidatePath("/browse"); revalidatePath("/search");
  redirect("/moderation");
}

/** Small, contextual editor used directly beside catalogue names and rules. */
export async function inlineEditAction(formData: FormData) {
  const moderator = await requireModerator();
  const entity = String(formData.get("entity") ?? "");
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const summary = "Inline edit";
  if (!id || !Number.isInteger(revision)) throw new Error("Invalid editor target.");
  await auditedCatalogMutation(moderator.id, "edit", summary, async (tx) => {
    if (entity === "node") {
      const [before] = await tx.select().from(lineageNodes).where(eq(lineageNodes.id, id));
      if (!before || before.revision !== revision) throw new Error("This name was changed by someone else. Refresh and try again.");
      const name = String(formData.get("name") ?? "").trim().normalize("NFC");
      if (!name) throw new Error("Enter a name.");
      await tx.update(lineageNodes).set({ name, revision: sql`${lineageNodes.revision} + 1`, updatedAt: new Date() }).where(eq(lineageNodes.id, id));
    } else if (entity === "transition") {
      const [before] = await tx.select().from(transitions).where(eq(transitions.id, id));
      if (!before || before.revision !== revision) throw new Error("This entry was changed by someone else. Refresh and try again.");
      const title = String(formData.get("title") ?? "").trim().normalize("NFC");
      const entrySummary = String(formData.get("summary") ?? "").trim().normalize("NFC");
      await tx.update(transitions).set({ title, summary: entrySummary, revision: sql`${transitions.revision} + 1`, updatedAt: new Date() }).where(eq(transitions.id, id));
    } else if (entity === "rule") {
      const [before] = await tx.select().from(soundChanges).where(eq(soundChanges.id, id));
      if (!before || before.revision !== revision) throw new Error("This rule was changed by someone else. Refresh and try again.");
      const displayNotation = String(formData.get("displayNotation") ?? "").trim().normalize("NFC");
      const explanation = String(formData.get("explanation") ?? "").trim().normalize("NFC");
      await tx.update(soundChanges).set({ displayNotation, explanation, revision: sql`${soundChanges.revision} + 1`, updatedAt: new Date() }).where(eq(soundChanges.id, id));
      const words = [...new Set(String(formData.get("words") ?? "").split(",").map((word) => word.trim().normalize("NFC")).filter(Boolean))];
      await tx.delete(examples).where(eq(examples.soundChangeId, id));
      if (words.length) await tx.insert(examples).values(words.map((targetForm, sortOrder) => ({ soundChangeId: id, sourceForm: targetForm, targetForm, targetWiktionaryUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(targetForm)}`, sortOrder })));
    } else throw new Error("Unknown editor target.");
  });
  revalidateCatalog();
  revalidatePath("/browse");
  revalidatePath("/search");
}

export async function editPairAction(formData: FormData) {
  const moderator = await requireModerator();
  const transitionId = String(formData.get("transitionId") ?? "");
  const transitionRevision = Number(formData.get("transitionRevision"));
  const summary = "Updated sound changes";
  const inputs = formData.getAll("input").map(String);
  const outputs = formData.getAll("output").map(String);
  const environments = formData.getAll("environment").map(String);
  const exceptions = formData.getAll("exceptions").map(String);
  const exceptionExampleLists = formData.getAll("exceptionExamples").map(String);
  const comments = formData.getAll("comment").map(String);
  const exampleLists = formData.getAll("examples").map(String);
  const ids = formData.getAll("ruleId").map(String);
  const sourceCitation = String(formData.get("sourceCitation") ?? "").trim().normalize("NFC");
  const sourceName = String(formData.get("sourceName") ?? "").trim().normalize("NFC");
  const targetName = String(formData.get("targetName") ?? "").trim().normalize("NFC");
  const originalRules = new Map(formData.getAll("originalRule").map(String).map(parseRuleSnapshot).map((rule) => [rule.id, rule]));
  if (!transitionId || !Number.isInteger(transitionRevision) || !sourceName || !targetName || sourceName === targetName || inputs.some((value, index) => !value.trim() || !outputs[index]?.trim())) throw new Error("Enter two different language or stage names, and complete every sound change.");
  await auditedCatalogMutation(moderator.id, "edit", summary, async (tx) => {
    // Locking the pair and its rules makes the comparison below atomic. A second
    // editor waits here, then merges against the first editor's committed data.
    await tx.execute(sql`select id from ${transitions} where ${transitions.id} = ${transitionId} for update`);
    await tx.execute(sql`select id from ${soundChanges} where ${soundChanges.transitionId} = ${transitionId} for update`);
    const [transition] = await tx.select().from(transitions).where(eq(transitions.id, transitionId));
    if (!transition) throw new Error("This language pair no longer exists.");
    const sourceResult = await findOrCreateNodeInTransaction(tx, sourceName);
    const targetResult = await findOrCreateNodeInTransaction(tx, targetName);
    const sourceChanged = transition.sourceNodeId !== sourceResult.node.id;
    const targetChanged = transition.targetNodeId !== targetResult.node.id;
    if (sourceChanged || targetChanged) {
      if (transition.revision !== transitionRevision) throw new Error("This language pair was changed by someone else. Refresh and try again.");
      await placeStagesForPairInTransaction(tx, sourceResult.node.id, targetResult.node.id, sourceResult.created);
      await tx.update(transitions).set({ sourceNodeId: sourceResult.node.id, targetNodeId: targetResult.node.id, title: `${sourceResult.node.name} to ${targetResult.node.name}`, revision: sql`${transitions.revision} + 1`, updatedAt: new Date() }).where(eq(transitions.id, transitionId));
    }
    const existing = await tx.select().from(soundChanges).where(eq(soundChanges.transitionId, transitionId));
    const existingSources = await tx.select({ displayCitation: sources.displayCitation }).from(transitionSources).innerJoin(sources, eq(transitionSources.sourceId, sources.id)).where(eq(transitionSources.transitionId, transitionId));
    const submittedIds = new Set(ids.filter(Boolean));
    let changed = false;
    for (const rule of existing) {
      if (!submittedIds.has(rule.id)) {
        const original = originalRules.get(rule.id);
        if (!original || !sameRuleSnapshot(rule, await ruleWords(tx, rule.id), original)) throw new Error("This sound change was changed by someone else. Refresh and resolve the conflicting deletion.");
        await tx.delete(soundChanges).where(eq(soundChanges.id, rule.id));
        changed = true;
      }
    }
    for (let index = 0; index < inputs.length; index += 1) {
      const submitted = submittedRule(inputs, outputs, environments, exceptions, exceptionExampleLists, comments, exampleLists, index);
      let ruleId = ids[index];
      if (ruleId) {
        const before = existing.find((rule) => rule.id === ruleId);
        const original = originalRules.get(ruleId);
        if (!before || !original) throw new Error("A sound change no longer exists.");
        const currentWords = await ruleWords(tx, ruleId);
        const merged = mergeRuleEdit(before, currentWords, original, submitted, index);
        if (merged.data) {
          await tx.update(soundChanges).set({ ...merged.data, revision: sql`${soundChanges.revision} + 1`, updatedAt: new Date() }).where(eq(soundChanges.id, ruleId));
          changed = true;
        }
        if (merged.words) {
          await tx.delete(examples).where(eq(examples.soundChangeId, ruleId));
          if (merged.words.length) await tx.insert(examples).values(merged.words.map((targetForm, sortOrder) => ({ soundChangeId: ruleId, sourceForm: targetForm, targetForm, targetWiktionaryUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(targetForm)}`, sortOrder })));
          changed = true;
        }
      } else {
        const data = ruleData(submitted, index, "");
        const [created] = await tx.insert(soundChanges).values({ transitionId, ...data }).returning(); ruleId = created.id;
        if (submitted.words.length) await tx.insert(examples).values(submitted.words.map((targetForm, sortOrder) => ({ soundChangeId: ruleId, sourceForm: targetForm, targetForm, targetWiktionaryUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(targetForm)}`, sortOrder })));
        changed = true;
      }
    }
    if (sourceCitation !== (existingSources[0]?.displayCitation ?? "")) {
      await tx.delete(transitionSources).where(eq(transitionSources.transitionId, transitionId));
      if (sourceCitation) {
        const [source] = await tx.insert(sources).values({ displayCitation: sourceCitation }).returning();
        await tx.insert(transitionSources).values({ transitionId, sourceId: source.id });
      }
      changed = true;
    }
    if (changed) {
      await tx.update(transitions).set({ revision: sql`${transitions.revision} + 1`, updatedAt: new Date() }).where(eq(transitions.id, transitionId));
    }
  });
  revalidateCatalog();
  revalidatePath("/browse"); revalidatePath("/search");
}

type RuleSnapshot = { id: string; input: string; output: string; environment: string; exceptions: string; exceptionExamples: string; comment: string; examples: string; explanation: string };
type SubmittedRule = { input: string; output: string; environment: string; exceptions: string; qualifier: string; exceptionExamples: string[]; words: string[] };

function parseRuleSnapshot(value: string): RuleSnapshot {
  try {
    const rule = JSON.parse(value);
    if (!rule || typeof rule !== "object" || ["id", "input", "output", "environment", "exceptions", "exceptionExamples", "comment", "examples", "explanation"].some((key) => typeof rule[key] !== "string")) throw new Error();
    return rule as RuleSnapshot;
  } catch {
    throw new Error("The edit form is invalid. Refresh and try again.");
  }
}

function submittedRule(inputs: string[], outputs: string[], environments: string[], exceptions: string[], exceptionExampleLists: string[], comments: string[], exampleLists: string[], index: number): SubmittedRule {
  return {
    input: inputs[index].trim().normalize("NFC"), output: outputs[index].trim().normalize("NFC"), environment: environments[index]?.trim().normalize("NFC") ?? "", exceptions: exceptions[index]?.trim().normalize("NFC") ?? "", qualifier: comments[index]?.trim().normalize("NFC") ?? "",
    exceptionExamples: wordsFrom(exceptionExampleLists[index] ?? ""), words: wordsFrom(exampleLists[index] ?? ""),
  };
}

function wordsFrom(value: string) { return [...new Set(value.split(",").map((word) => word.trim().normalize("NFC")).filter(Boolean))]; }
function sameWords(left: string[], right: string[]) { return left.length === right.length && left.every((word, index) => word === right[index]); }
async function ruleWords(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ruleId: string) { return (await tx.select({ targetForm: examples.targetForm }).from(examples).where(eq(examples.soundChangeId, ruleId)).orderBy(examples.sortOrder)).map((example) => example.targetForm); }

function sameRuleSnapshot(rule: typeof soundChanges.$inferSelect, words: string[], snapshot: RuleSnapshot) {
  return rule.input === snapshot.input && rule.output === snapshot.output && rule.environment === snapshot.environment && rule.exceptions === snapshot.exceptions && sameWords(rule.exceptionExamples, wordsFrom(snapshot.exceptionExamples)) && rule.qualifier === snapshot.comment && sameWords(words, wordsFrom(snapshot.examples)) && rule.explanation === snapshot.explanation;
}

function ruleData(rule: SubmittedRule, sortOrder: number, explanation: string) {
  return { input: rule.input, output: rule.output, environment: rule.environment, exceptions: rule.exceptions, exceptionExamples: rule.exceptionExamples, qualifier: rule.qualifier, explanation, displayNotation: composeRule(rule.input, rule.output, rule.environment, rule.qualifier, rule.exceptions), sortOrder };
}

function mergeRuleEdit(current: typeof soundChanges.$inferSelect, currentWords: string[], original: RuleSnapshot, submitted: SubmittedRule, sortOrder: number) {
  const originalData: SubmittedRule = { input: original.input, output: original.output, environment: original.environment, exceptions: original.exceptions, qualifier: original.comment, exceptionExamples: wordsFrom(original.exceptionExamples), words: wordsFrom(original.examples) };
  const merged: SubmittedRule = { input: current.input, output: current.output, environment: current.environment, exceptions: current.exceptions, qualifier: current.qualifier, exceptionExamples: current.exceptionExamples, words: currentWords };
  for (const key of ["input", "output", "environment", "exceptions", "qualifier", "exceptionExamples"] as const) {
    const oursChanged = Array.isArray(submitted[key]) ? !sameWords(submitted[key], originalData[key] as string[]) : submitted[key] !== originalData[key];
    const theirsChanged = Array.isArray(submitted[key]) ? !sameWords(current[key] as string[], originalData[key] as string[]) : current[key] !== originalData[key];
    if (oursChanged && theirsChanged && (Array.isArray(submitted[key]) ? !sameWords(submitted[key] as string[], current[key] as string[]) : submitted[key] !== current[key])) throw new Error("This sound change has a conflicting edit. Refresh and resolve the conflicting field.");
    if (oursChanged) Object.assign(merged, { [key]: submitted[key] });
  }
  const oursChangedWords = !sameWords(submitted.words, originalData.words);
  const theirsChangedWords = !sameWords(currentWords, originalData.words);
  if (oursChangedWords && theirsChangedWords && !sameWords(submitted.words, currentWords)) throw new Error("This sound change has conflicting example edits. Refresh and resolve them.");
  const data = ruleData(merged, sortOrder, current.explanation);
  const dataChanged = current.input !== data.input || current.output !== data.output || current.environment !== data.environment || current.exceptions !== data.exceptions || !sameWords(current.exceptionExamples, data.exceptionExamples) || current.qualifier !== data.qualifier || current.displayNotation !== data.displayNotation || current.sortOrder !== data.sortOrder;
  return { data: dataChanged ? data : null, words: oursChangedWords ? submitted.words : null };
}

export async function movePairAction(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("transitionId") ?? ""); const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) throw new Error("Invalid pair move.");
  const list = await db.select().from(transitions).orderBy(transitions.sortOrder, transitions.title);
  const index = list.findIndex((entry) => entry.id === id); const swapIndex = index + (direction === "up" ? -1 : 1);
  if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
  [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  await auditedCatalogMutation(moderator.id, "reorder", "Reordered language pairs", async (tx) => { for (const [order, entry] of list.entries()) await tx.update(transitions).set({ sortOrder: order, updatedAt: new Date() }).where(eq(transitions.id, entry.id)); });
  revalidateCatalog();
  revalidatePath("/browse");
}

export async function deletePairAction(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("transitionId") ?? "");
  if (!id) throw new Error("Invalid language pair.");
  await auditedCatalogMutation(moderator.id, "delete", "Deleted language pair", async (tx) => {
    const [before] = await tx.select().from(transitions).where(eq(transitions.id, id));
    if (!before) throw new Error("This language pair no longer exists.");
    await tx.delete(transitions).where(eq(transitions.id, id));
    await pruneUnusedStages(tx);
  });
  revalidateCatalog();
  revalidatePath("/browse"); revalidatePath("/search");
}

export async function addPairAction(formData: FormData) {
  const moderator = await requireModerator();
  const sourceName = String(formData.get("sourceName") ?? "").trim().normalize("NFC"); const targetName = String(formData.get("targetName") ?? "").trim().normalize("NFC");
  if (!sourceName || !targetName || sourceName === targetName) throw new Error("Enter two different language or stage names.");
  const existingPairs = await db.select({ id: transitions.id }).from(transitions);
  await auditedCatalogMutation(moderator.id, "create", "Added language pair", async (tx) => {
    if (existingPairs.length === 0) await pruneUnusedStages(tx);
    const sourceResult = await findOrCreateNodeInTransaction(tx, sourceName);
    const targetResult = await findOrCreateNodeInTransaction(tx, targetName);
    const source = sourceResult.node; const target = targetResult.node;
    await placeStagesForPairInTransaction(tx, source.id, target.id, sourceResult.created);
    const title = `${source.name} to ${target.name}`; const slug = `${slugify(title)}-${Date.now().toString(36)}`;
    const [after] = await tx.insert(transitions).values({ sourceNodeId: source.id, targetNodeId: target.id, title, slug, sortOrder: (await tx.select({ id: transitions.id }).from(transitions)).length }).returning();
    await migrateBypassedTransitionRules(tx, after.id, source.id, target.id);
  });
  revalidateCatalog();
  revalidatePath("/browse"); revalidatePath("/search");
}

async function findOrCreateNodeInTransaction(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], name: string): Promise<{ node: typeof lineageNodes.$inferSelect; created: boolean }> {
  const [existing] = await tx.select().from(lineageNodes).where(eq(lineageNodes.name, name)).limit(1);
  if (existing) return { node: existing, created: false };
  const [created] = await tx.insert(lineageNodes).values({ name, slug: `${slugify(name) || "stage"}-${Date.now().toString(36)}`, kind: "stage", sortOrder: (await tx.select({ id: lineageNodes.id }).from(lineageNodes)).length }).returning();
  return { node: created, created: true };
}

async function placeStagesForPairInTransaction(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], sourceId: string, targetId: string, sourceWasCreated: boolean) {
  const nodes = await tx.select().from(lineageNodes);
  const target = nodes.find((node) => node.id === targetId);
  if (!target) return;
  let ancestor = nodes.find((node) => node.id === sourceId)?.parentId;
  while (ancestor) {
    if (ancestor === targetId) throw new Error("This pair would create a circular stage hierarchy.");
    ancestor = nodes.find((node) => node.id === ancestor)?.parentId;
  }
  if (sourceWasCreated && target.parentId) await tx.update(lineageNodes).set({ parentId: target.parentId, updatedAt: new Date() }).where(eq(lineageNodes.id, sourceId));
  if (target.parentId !== sourceId) await tx.update(lineageNodes).set({ parentId: sourceId, updatedAt: new Date() }).where(eq(lineageNodes.id, targetId));
}

/** Nodes are only useful while a pair refers to them; remove abandoned hierarchy after deletion. */
async function pruneUnusedStages(tx: CatalogTransaction) {
  while (true) {
    const [nodes, pairs] = await Promise.all([tx.select().from(lineageNodes), tx.select().from(transitions)]);
    const used = new Set(pairs.flatMap((pair) => [pair.sourceNodeId, pair.targetNodeId]));
    const removable = nodes.filter((node) => !used.has(node.id) && !nodes.some((candidate) => candidate.parentId === node.id));
    if (removable.length === 0) return;
    for (const node of removable) await tx.delete(lineageNodes).where(eq(lineageNodes.id, node.id));
  }
}

export async function createModeratorAction(formData: FormData) {
  const current = await requireModerator();
  if (current.role !== "admin") throw new Error("Administrator access is required.");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "moderator";
  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) throw new Error("Invalid username.");
  if (password.length < 12) throw new Error("Passwords must contain at least 12 characters.");
  await db.insert(moderators).values({ username, passwordHash: await passwordHash(password), role });
  revalidatePath("/moderation/accounts");
}

export async function toggleModeratorAction(formData: FormData) {
  const current = await requireModerator();
  if (current.role !== "admin") throw new Error("Administrator access is required.");
  const id = String(formData.get("moderatorId") ?? "");
  if (id === current.id) throw new Error("You cannot disable your own account.");
  const disabled = formData.get("disabled") === "true";
  await db.update(moderators).set({ disabled, updatedAt: new Date() }).where(eq(moderators.id, id));
  revalidatePath("/moderation/accounts");
}

export async function revertCatalogChangeAction(formData: FormData) {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") throw new Error("Administrator access is required.");
  const changeId = String(formData.get("changeId") ?? "");
  if (!changeId) throw new Error("Invalid history entry.");
  await revertCatalogChange(changeId, moderator.id);
  revalidateCatalog();
  revalidatePath("/"); revalidatePath("/browse"); revalidatePath("/search"); revalidatePath("/moderation/history");
}

export async function verifyCatalogChangeAction(formData: FormData) {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") throw new Error("Administrator access is required.");
  const changeId = String(formData.get("changeId") ?? "");
  if (!changeId) throw new Error("Invalid history entry.");
  const [change] = await db.select({ id: catalogChanges.id }).from(catalogChanges).where(eq(catalogChanges.id, changeId)).limit(1);
  if (!change) throw new Error("This history entry does not exist.");
  await db.insert(catalogChangeVerifications).values({ changeId, moderatorId: moderator.id }).onConflictDoNothing();
  revalidatePath("/browse");
}

export async function discardCatalogChangeAction(formData: FormData) {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") throw new Error("Administrator access is required.");
  const changeId = String(formData.get("changeId") ?? "");
  if (!changeId) throw new Error("Invalid history entry.");
  await revertCatalogChange(changeId, moderator.id);
  const [reversion] = await db.select({ id: catalogChanges.id }).from(catalogChanges).where(eq(catalogChanges.revertsChangeId, changeId)).limit(1);
  await db.insert(catalogChangeVerifications).values([
    { changeId, moderatorId: moderator.id },
    ...(reversion ? [{ changeId: reversion.id, moderatorId: moderator.id }] : []),
  ]).onConflictDoNothing();
  revalidateCatalog();
  revalidatePath("/"); revalidatePath("/browse"); revalidatePath("/search"); revalidatePath("/moderation/history");
}

export async function verifyAllCatalogChangesAction() {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") throw new Error("Administrator access is required.");
  const changes = await db.select({ id: catalogChanges.id }).from(catalogChanges)
    .leftJoin(catalogChangeVerifications, eq(catalogChanges.id, catalogChangeVerifications.changeId))
    .where(sql`${catalogChangeVerifications.changeId} is null`);
  if (changes.length) await db.insert(catalogChangeVerifications).values(changes.map((change) => ({ changeId: change.id, moderatorId: moderator.id }))).onConflictDoNothing();
  revalidatePath("/browse");
}
