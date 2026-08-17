type Snapshot = Record<string, unknown>;

export type HistoryItem = { tableName: string; rowKey: string; beforeSnapshot: unknown; afterSnapshot: unknown };
export type HistoryChange = { items: HistoryItem[] };
type ReferenceCatalog = {
  nodes: Array<Snapshot & { id: string }>;
  transitions: Array<Snapshot & { id: string; rules?: Array<Snapshot & { id: string; examples?: Array<Snapshot & { id: string }>; sources?: Array<Snapshot & { id: string }> }>; sources?: Array<Snapshot & { id: string }> }>;
};
export type HistoryReferences = {
  lineage_nodes: Map<string, Snapshot>;
  transitions: Map<string, Snapshot>;
  sound_changes: Map<string, Snapshot>;
  examples: Map<string, Snapshot>;
  sources: Map<string, Snapshot>;
};

const tableLabels: Record<string, string> = {
  lineage_nodes: "Language or lineage", transitions: "Language pair", sound_changes: "Sound change",
  examples: "Example", sources: "Source", transition_sources: "Language-pair source",
  sound_change_sources: "Sound-change source", slug_aliases: "Previous address",
};
const fieldLabels: Record<string, string> = {
  id: "ID", sourceNodeId: "Source language", targetNodeId: "Target language", parentId: "Parent language or group",
  transitionId: "Language pair", soundChangeId: "Sound change", sourceId: "Source", displayNotation: "Notation",
  sortOrder: "Position", approvalStatus: "Review status", relationshipKind: "Relationship", displayCitation: "Citation",
  containerTitle: "Publication", accessedAt: "Accessed", sourceForm: "Source form", targetForm: "Target form",
  sourceReconstructed: "Reconstructed source", targetReconstructed: "Reconstructed target", sourceWiktionaryUrl: "Source Wiktionary link",
  targetWiktionaryUrl: "Target Wiktionary link", exceptionExamples: "Exception examples", isDemo: "Demo content",
  createdAt: "Created", updatedAt: "Updated", reviewedAt: "Reviewed", reviewedBy: "Reviewed by (moderator ID)",
  submittedBy: "Submitted by (moderator ID)", entityType: "Record type", entityId: "Record", oldSlug: "Previous address",
};

export function buildHistoryReferences(changes: HistoryChange[], catalog: ReferenceCatalog): HistoryReferences {
  const references: HistoryReferences = {
    lineage_nodes: new Map(), transitions: new Map(), sound_changes: new Map(), examples: new Map(), sources: new Map(),
  };
  // Deleted records can only be named from their audit snapshots.
  for (const change of [...changes].reverse()) for (const item of change.items) {
    if (!(item.tableName in references)) continue;
    const map = references[item.tableName as keyof HistoryReferences];
    mergeReference(map, item.rowKey, asSnapshot(item.beforeSnapshot));
    mergeReference(map, item.rowKey, asSnapshot(item.afterSnapshot));
  }
  // Current records take precedence; historical snapshots fill in deleted ones.
  for (const node of catalog.nodes) mergeReference(references.lineage_nodes, node.id, node, true);
  for (const transition of catalog.transitions) {
    mergeReference(references.transitions, transition.id, transition, true);
    for (const source of transition.sources ?? []) mergeReference(references.sources, source.id, source, true);
    for (const rule of transition.rules ?? []) {
      mergeReference(references.sound_changes, rule.id, rule, true);
      for (const example of rule.examples ?? []) mergeReference(references.examples, example.id, example, true);
      for (const source of rule.sources ?? []) mergeReference(references.sources, source.id, source, true);
    }
  }
  return references;
}

export function describeHistoryItem(item: HistoryItem, references: HistoryReferences): string {
  const snapshot = { ...asSnapshot(item.beforeSnapshot), ...asSnapshot(item.afterSnapshot) };
  const known = item.tableName in references ? references[item.tableName as keyof HistoryReferences].get(item.rowKey) : undefined;
  const row = { ...known, ...snapshot };
  const prefix = tableLabels[item.tableName] ?? sentenceCase(item.tableName);
  if (item.tableName === "lineage_nodes") return `${prefix}: ${text(row.name) ?? "Unnamed language"}`;
  if (item.tableName === "transitions") return `${prefix}: ${transitionName(row, references)}`;
  if (item.tableName === "sound_changes") return `${prefix}: ${text(row.displayNotation) ?? "Unnamed rule"}${transitionSuffix(row.transitionId, references)}`;
  if (item.tableName === "examples") return `${prefix}: ${[text(row.sourceForm), text(row.targetForm)].filter(Boolean).join(" → ") || "Unnamed example"}${ruleSuffix(row.soundChangeId, references)}`;
  if (item.tableName === "sources") return `${prefix}: ${text(row.displayCitation) ?? text(row.title) ?? "Unnamed source"}`;
  if (item.tableName === "transition_sources") {
    const [transitionId, sourceId] = item.rowKey.split(":");
    return `${prefix}: ${transitionName(references.transitions.get(transitionId) ?? {}, references)} — ${sourceName(sourceId, references)}`;
  }
  if (item.tableName === "sound_change_sources") {
    const [ruleId, sourceId] = item.rowKey.split(":");
    return `${prefix}: ${ruleName(ruleId, references)} — ${sourceName(sourceId, references)}`;
  }
  if (item.tableName === "slug_aliases") return `${prefix}: ${text(row.oldSlug) ?? item.rowKey}`;
  return prefix;
}

export function historyOperation(item: HistoryItem): "Created" | "Deleted" | "Changed" {
  if (item.beforeSnapshot === null) return "Created";
  if (item.afterSnapshot === null) return "Deleted";
  return "Changed";
}

export function changedHistoryFields(item: HistoryItem, references: HistoryReferences) {
  const before = asSnapshot(item.beforeSnapshot); const after = asSnapshot(item.afterSnapshot);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, label: fieldLabels[key] ?? sentenceCase(key), before: formatValue(key, before[key], item, references), after: formatValue(key, after[key], item, references) }));
}

export function formatValue(key: string, value: unknown, item: HistoryItem, references: HistoryReferences): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "None";
  if (["createdAt", "updatedAt", "reviewedAt"].includes(key) && typeof value === "string") {
    const date = new Date(value); if (!Number.isNaN(date.valueOf())) return date.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  }
  if (key === "id") {
    if (item.tableName === "lineage_nodes") return lineageName(String(value), references);
    if (item.tableName === "transitions") return transitionName(references.transitions.get(String(value)) ?? {}, references);
    if (item.tableName === "sound_changes") return ruleName(String(value), references);
    if (item.tableName === "sources") return sourceName(String(value), references);
    if (item.tableName === "examples") {
      const row = references.examples.get(String(value));
      return row ? [text(row.sourceForm), text(row.targetForm)].filter(Boolean).join(" → ") : String(value);
    }
  }
  if (key === "sourceNodeId" || key === "targetNodeId" || key === "parentId") return lineageName(String(value), references);
  if (key === "transitionId") return transitionName(references.transitions.get(String(value)) ?? {}, references);
  if (key === "soundChangeId") return ruleName(String(value), references);
  if (key === "sourceId") return sourceName(String(value), references);
  if (key === "entityId") {
    const row = { ...asSnapshot(item.beforeSnapshot), ...asSnapshot(item.afterSnapshot) };
    if (row.entityType === "lineage") return lineageName(String(value), references);
    if (row.entityType === "transition") return transitionName(references.transitions.get(String(value)) ?? {}, references);
  }
  return typeof value === "object" ? Object.entries(value as Snapshot).map(([name, entry]) => `${fieldLabels[name] ?? sentenceCase(name)}: ${String(entry)}`).join("; ") : String(value);
}

function mergeReference(map: Map<string, Snapshot>, id: string, row: Snapshot, overwrite = false) { const current = map.get(id) ?? {}; map.set(id, overwrite ? { ...current, ...row } : { ...row, ...current }); }
function transitionName(row: Snapshot, refs: HistoryReferences) { return row.sourceNodeId && row.targetNodeId ? `${lineageName(String(row.sourceNodeId), refs)} → ${lineageName(String(row.targetNodeId), refs)}` : text(row.title) ?? "Unnamed language pair"; }
function lineageName(id: string, refs: HistoryReferences) { return text(refs.lineage_nodes.get(id)?.name) ?? `Unknown language (${id})`; }
function sourceName(id: string, refs: HistoryReferences) { const row = refs.sources.get(id); return text(row?.displayCitation) ?? text(row?.title) ?? `Unknown source (${id})`; }
function ruleName(id: string, refs: HistoryReferences) { return text(refs.sound_changes.get(id)?.displayNotation) ?? `Unknown sound change (${id})`; }
function transitionSuffix(id: unknown, refs: HistoryReferences) { return typeof id === "string" ? ` in ${transitionName(refs.transitions.get(id) ?? {}, refs)}` : ""; }
function ruleSuffix(id: unknown, refs: HistoryReferences) { return typeof id === "string" ? ` for ${ruleName(id, refs)}` : ""; }
function asSnapshot(value: unknown): Snapshot { return value && typeof value === "object" && !Array.isArray(value) ? value as Snapshot : {}; }
function text(value: unknown) { return typeof value === "string" && value ? value : undefined; }
function sentenceCase(value: string) { const result = value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2"); return result.charAt(0).toUpperCase() + result.slice(1); }
