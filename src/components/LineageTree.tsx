import type { Catalog, CatalogNode, CatalogTransition } from "@/db/queries";
import type { ReactNode } from "react";
import { EntryView } from "./EntryView";
import { PairCreator } from "./PairCreator";
import { deletedRulesForTransition, deletedTransitions, historicalNodeName, InlineReview, reviewClass, snapshotText, transitionReviewTargets, type BrowseChange } from "./BrowseInlineReview";

type BrowseTocItem = { entry: CatalogTransition; number: string; children: BrowseTocItem[] };

export function CatalogBrowse({ entries, nodes, canEdit, catalog, reviewChanges = [] }: { entries: CatalogTransition[]; nodes: CatalogNode[]; canEdit: boolean; catalog: Catalog; reviewChanges?: BrowseChange[] }) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const numberedEntries = entries.map((entry) => ({ entry, number: numberForEntry(entry, entries, nodeMap) })).sort((a, b) => compareNumbers(a.number, b.number));
  const tocItems = buildBrowseToc(numberedEntries, entries);
  return <>
    {numberedEntries.length > 0 && <nav className="browse-toc" aria-labelledby="browse-toc-heading">
      <h2 id="browse-toc-heading">Contents</h2>
      <BrowseTocList items={tocItems} />
    </nav>}
    <section className="catalog-browse" aria-label="Sound-change catalogue">{canEdit && <PairCreator />}{entries.length === 0 && !canEdit && <p className="empty-state">No entries yet.</p>}
    {numberedEntries.map(({ entry, number }) => { const targets = transitionReviewTargets(entry, reviewChanges); return <article className={`browse-entry ${reviewClass(targets)}`} id={`pair-${entry.slug}`} key={entry.id}>
      <h2><span className="pair-number">{number}</span><span className="pair-name">{entry.sourceName}</span> <span className="pair-arrow">→</span> <span className="pair-name">{entry.targetName}</span></h2>
      {entry.sources[0] && <p className="browse-citation">{entry.sources[0].displayCitation}</p>}
      <InlineReview targets={targets} catalog={catalog} />
      <EntryView entry={entry} nodes={nodes} canEdit={canEdit} reviewChanges={reviewChanges} catalog={catalog} deletedRules={deletedRulesForTransition(entry.id, reviewChanges)} />
    </article>; })}
    {deletedTransitions(reviewChanges).map(({ change, item, snapshot }) => {
      const source = nodes.find((node) => node.id === snapshot.sourceNodeId)?.name ?? historicalNodeName(snapshot.sourceNodeId, reviewChanges, "Deleted language");
      const target = nodes.find((node) => node.id === snapshot.targetNodeId)?.name ?? historicalNodeName(snapshot.targetNodeId, reviewChanges, "Deleted language");
      return <article className="browse-entry inline-change inline-change--deleted" key={`${change.id}-${item.id}`}>
        <h2><span className="pair-number">—</span><del>{source} <span className="pair-arrow">→</span> {target}</del></h2>
        <InlineReview targets={[{ change, items: [item] }]} catalog={catalog} suppressDiff />
        <ol className="rule-list">{deletedRulesForTransition(String(snapshot.id ?? item.rowKey), [change]).map((rule) => <li className="rule" key={rule.item.id}><span className="rule-notation"><del>{snapshotText(rule.snapshot, "displayNotation", "Deleted sound change")}</del></span></li>)}</ol>
      </article>;
    })}
    </section>
  </>;
}

function buildBrowseToc(numberedEntries: { entry: CatalogTransition; number: string }[], allEntries: CatalogTransition[]) {
  const items = new Map(numberedEntries.map(({ entry, number }) => [entry.id, { entry, number, children: [] as BrowseTocItem[] }]));
  const roots: BrowseTocItem[] = [];
  for (const numberedEntry of numberedEntries) {
    const item = items.get(numberedEntry.entry.id)!;
    const parent = parentForEntry(numberedEntry.entry, allEntries);
    const parentItem = parent?.id === item.entry.id ? undefined : items.get(parent?.id ?? "");
    if (parentItem) parentItem.children.push(item);
    else roots.push(item);
  }
  return roots;
}

function BrowseTocList({ items }: { items: BrowseTocItem[] }): ReactNode {
  return <ol>{items.map(({ entry, number, children }) => <li key={entry.id}>
    <a href={`#pair-${entry.slug}`}><span className="browse-toc__number">{number}</span><span>{entry.sourceName} <span aria-hidden="true">→</span> {entry.targetName}</span></a>
    {children.length > 0 && <BrowseTocList items={children} />}
  </li>)}</ol>;
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
  const parent = parentForEntry(entry, allEntries);
  if (parent) return `${numberForEntry(parent, allEntries, nodeMap, seen)}.${index}`;
  const source = nodeMap.get(entry.sourceNodeId);
  if (!source) return `1.${index}`;
  const depth = nodeNumber(source, nodeMap).split(".").length;
  return depth > 1 && index === 1 ? nodeNumber(source, nodeMap) : `${nodeNumber(source, nodeMap)}.${index}`;
}

function parentForEntry(entry: CatalogTransition, allEntries: CatalogTransition[]) {
  return allEntries.filter((candidate) => candidate.targetNodeId === entry.sourceNodeId).sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))[0];
}

function compareNumbers(left: string, right: string) {
  const leftParts = left.split(".").map(Number); const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) { const difference = (leftParts[index] ?? -1) - (rightParts[index] ?? -1); if (difference) return difference; }
  return 0;
}
