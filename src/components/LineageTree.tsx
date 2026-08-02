import type { CatalogNode, CatalogTransition } from "@/db/queries";
import { EntryView } from "./EntryView";
import { PairCreator } from "./PairCreator";

export function CatalogBrowse({ entries, nodes, canEdit, canDeleteApproved = false }: { entries: CatalogTransition[]; nodes: CatalogNode[]; canEdit: boolean; canDeleteApproved?: boolean }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const numberedEntries = entries.map((entry) => ({ entry, number: numberForEntry(entry, entries, nodeMap) })).sort((a, b) => compareNumbers(a.number, b.number));
  return <section className="catalog-browse" aria-label="Sound-change catalogue">{canEdit && <PairCreator />}{entries.length === 0 && !canEdit && <p className="empty-state">No entries yet.</p>}
    {numberedEntries.map(({ entry, number }) => { return <article className="browse-entry" key={entry.id}>
      <h2><span className="pair-number">{number}</span><span className={`pair-name${entry.sourceApprovalStatus === "pending" ? " pending-addition" : ""}`}>{entry.sourceName}</span> <span className="pair-arrow">→</span> <span className={`pair-name${entry.targetApprovalStatus === "pending" ? " pending-addition" : ""}`}>{entry.targetName}</span>{(entry.sourceApprovalStatus === "pending" || entry.targetApprovalStatus === "pending") && <span className="pending-label">Pending review</span>}</h2>
      {entry.sources[0] && <p className="browse-citation">{entry.sources[0].displayCitation}</p>}
      <EntryView entry={entry} nodes={nodes} canEdit={canEdit} canDeleteApproved={canDeleteApproved} />
    </article>; })}
  </section>;
}

function nodeNumber(node: CatalogNode, nodeMap: Map<string, CatalogNode>) {
  const parts: number[] = [];
  let current: CatalogNode | undefined = node;
  while (current) {
    const siblings = [...nodeMap.values()].filter((candidate) => candidate.parentId === current?.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    parts.unshift(siblings.findIndex((candidate) => candidate.id === current?.id) + 1);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  return parts.join(".");
}

function numberForEntry(entry: CatalogTransition, allEntries: CatalogTransition[], nodeMap: Map<string, CatalogNode>, seen = new Set<string>()): string {
  if (seen.has(entry.id)) return nodeMap.get(entry.sourceNodeId) ? nodeNumber(nodeMap.get(entry.sourceNodeId)!, nodeMap) : "—";
  seen.add(entry.id);
  const ordered = allEntries.filter((candidate) => candidate.sourceNodeId === entry.sourceNodeId).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const index = ordered.findIndex((candidate) => candidate.id === entry.id) + 1;
  const parent = allEntries.filter((candidate) => candidate.targetNodeId === entry.sourceNodeId).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))[0];
  if (parent) return `${numberForEntry(parent, allEntries, nodeMap, seen)}.${index}`;
  const source = nodeMap.get(entry.sourceNodeId);
  if (!source) return `1.${index}`;
  const depth = nodeNumber(source, nodeMap).split(".").length;
  return depth > 1 && index === 1 ? nodeNumber(source, nodeMap) : `${nodeNumber(source, nodeMap)}.${index}`;
}

function compareNumbers(left: string, right: string) {
  const leftParts = left.split(".").map(Number); const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) { const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1); if (difference) return difference; }
  return 0;
}
