import type { Catalog, CatalogRule, CatalogTransition } from "@/db/queries";
import { buildHistoryReferences, changedHistoryFields, historyOperation, type HistoryItem } from "@/lib/catalog-history";
import { BrowseReviewActions } from "./BrowseReviewActions";

export type BrowseChange = {
  id: string;
  action: string;
  summary: string;
  username: string;
  createdAt: Date;
  items: Array<HistoryItem & { id: string }>;
};

export type ReviewTarget = { change: BrowseChange; items: BrowseChange["items"] };
const hiddenFields = new Set(["id", "createdAt", "updatedAt", "revision", "reviewedAt", "reviewedBy", "submittedBy", "approvalStatus", "isDemo"]);

export function reviewClass(targets: ReviewTarget[]) {
  const operations = targets.flatMap((target) => target.items.map(historyOperation));
  if (operations.includes("Deleted")) return "inline-change inline-change--deleted";
  if (operations.includes("Created")) return "inline-change inline-change--created";
  return targets.length ? "inline-change inline-change--changed" : "";
}

export function InlineReview({ targets, catalog, suppressDiff = false }: { targets: ReviewTarget[]; catalog: Catalog; suppressDiff?: boolean }) {
  if (!targets.length) return null;
  const references = buildHistoryReferences(targets.map((target) => target.change), catalog);
  return <span className="inline-review">{targets.map(({ change, items }) => {
    const operations = items.map(historyOperation);
    const operation = operations.includes("Deleted") ? "Deleted" : operations.includes("Created") ? "Added" : "Changed";
    const fields = items.flatMap((item) => changedHistoryFields(item, references)).filter((field) => !hiddenFields.has(field.key));
    return <span className="inline-review__change" key={change.id}>
      <span className={`inline-review__label inline-review__label--${operation.toLowerCase()}`}>{operation}</span>
      {!suppressDiff && fields.length > 0 && operation === "Changed" && <span className="inline-review__diff">{fields.map((field, index) => <span key={`${field.key}-${index}`}><b>{field.label}:</b> <del>{field.before}</del> <span aria-hidden="true">→</span> <ins>{field.after}</ins></span>)}</span>}
      {!suppressDiff && fields.length > 0 && operation === "Deleted" && <span className="inline-review__diff">{fields.map((field, index) => <span key={`${field.key}-${index}`}><b>{field.label}:</b> <del>{field.before}</del></span>)}</span>}
      <BrowseReviewActions changeId={change.id} />
    </span>;
  })}</span>;
}

export function transitionReviewTargets(entry: CatalogTransition, changes: BrowseChange[]): ReviewTarget[] {
  return changes.map((change) => {
    const linkedSourceIds = new Set(change.items.filter((item) => item.tableName === "transition_sources" && item.rowKey.startsWith(`${entry.id}:`)).map((item) => item.rowKey.split(":")[1]));
    const items = change.items.filter((item) => item.tableName === "transitions" && item.rowKey === entry.id
      || item.tableName === "lineage_nodes" && (item.rowKey === entry.sourceNodeId || item.rowKey === entry.targetNodeId)
      || item.tableName === "transition_sources" && item.rowKey.startsWith(`${entry.id}:`)
      || item.tableName === "sources" && (linkedSourceIds.has(item.rowKey) || entry.sources.some((source) => source.id === item.rowKey)));
    return { change, items };
  }).filter((target) => target.items.length > 0);
}

export function ruleReviewTargets(rule: CatalogRule, changes: BrowseChange[]): ReviewTarget[] {
  return changes.map((change) => {
    const linkedSourceIds = new Set(change.items.filter((item) => item.tableName === "sound_change_sources" && item.rowKey.startsWith(`${rule.id}:`)).map((item) => item.rowKey.split(":")[1]));
    const items = change.items.filter((item) => item.tableName === "sound_changes" && item.rowKey === rule.id
      || item.tableName === "examples" && snapshotId(item, "soundChangeId") === rule.id
      || item.tableName === "sound_change_sources" && item.rowKey.startsWith(`${rule.id}:`)
      || item.tableName === "sources" && (linkedSourceIds.has(item.rowKey) || rule.sources.some((source) => source.id === item.rowKey)));
    return { change, items };
  }).filter((target) => target.items.length > 0);
}

export function deletedTransitions(changes: BrowseChange[]) {
  return changes.flatMap((change) => change.items.filter((item) => item.tableName === "transitions" && historyOperation(item) === "Deleted").map((item) => ({ change, item, snapshot: asSnapshot(item.beforeSnapshot) })));
}

export function deletedRulesForTransition(transitionId: string, changes: BrowseChange[]) {
  return changes.flatMap((change) => change.items.filter((item) => item.tableName === "sound_changes" && historyOperation(item) === "Deleted" && snapshotId(item, "transitionId") === transitionId).map((item) => ({ change, item, snapshot: asSnapshot(item.beforeSnapshot) })));
}

export function DeletedRule({ change, item, snapshot, catalog }: { change: BrowseChange; item: BrowseChange["items"][number]; snapshot: Record<string, unknown>; catalog: Catalog }) {
  return <li className="rule inline-change inline-change--deleted">
    <div className="rule-heading"><span className="rule-notation"><del>{snapshotText(snapshot, "displayNotation", "Deleted sound change")}</del></span></div>
    {typeof snapshot.explanation === "string" && snapshot.explanation && <p className="rule-explanation"><del>{snapshot.explanation}</del></p>}
    <InlineReview targets={[{ change, items: [item] }]} catalog={catalog} suppressDiff />
  </li>;
}

export function snapshotText(snapshot: Record<string, unknown>, key: string, fallback: string) {
  return typeof snapshot[key] === "string" && snapshot[key] ? String(snapshot[key]) : fallback;
}

export function historicalNodeName(nodeId: unknown, changes: BrowseChange[], fallback: string) {
  if (typeof nodeId !== "string") return fallback;
  for (const change of changes) for (const item of change.items) {
    if (item.tableName !== "lineage_nodes" || item.rowKey !== nodeId) continue;
    const before = asSnapshot(item.beforeSnapshot); const after = asSnapshot(item.afterSnapshot);
    if (typeof after.name === "string") return after.name;
    if (typeof before.name === "string") return before.name;
  }
  return fallback;
}

function snapshotId(item: HistoryItem, key: string) {
  const before = asSnapshot(item.beforeSnapshot); const after = asSnapshot(item.afterSnapshot);
  return typeof after[key] === "string" ? after[key] as string : typeof before[key] === "string" ? before[key] as string : undefined;
}

function asSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
