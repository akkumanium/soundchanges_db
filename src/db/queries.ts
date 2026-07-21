import { and, asc, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "./index";
import {
  examples,
  lineageNodes,
  revisionEvents,
  soundChanges,
  soundChangeSources,
  slugAliases,
  sources,
  transitions,
  transitionSources,
} from "./schema";

export type CatalogSource = typeof sources.$inferSelect;
export type CatalogExample = typeof examples.$inferSelect;
export type CatalogRule = typeof soundChanges.$inferSelect & {
  examples: CatalogExample[];
  sources: CatalogSource[];
};
export type CatalogTransition = typeof transitions.$inferSelect & {
  sourceName: string;
  targetName: string;
  rules: CatalogRule[];
  sources: CatalogSource[];
};
export type CatalogNode = typeof lineageNodes.$inferSelect & {
  children: CatalogNode[];
  entries: CatalogTransition[];
};

export type Catalog = {
  roots: CatalogNode[];
  nodes: CatalogNode[];
  transitions: CatalogTransition[];
  demo: boolean;
  databaseAvailable: boolean;
};

export async function getCatalog(): Promise<Catalog> {
  await connection();
  try {
    const [nodeRows, transitionRows, ruleRows, exampleRows, sourceRows, transitionSourceRows, changeSourceRows] = await Promise.all([
      db.select().from(lineageNodes).orderBy(asc(lineageNodes.sortOrder), asc(lineageNodes.name)),
      db.select().from(transitions).orderBy(asc(transitions.sortOrder), asc(transitions.title)),
      db.select().from(soundChanges).orderBy(asc(soundChanges.sortOrder)),
      db.select().from(examples).orderBy(asc(examples.sortOrder)),
      db.select().from(sources).orderBy(asc(sources.displayCitation)),
      db.select().from(transitionSources),
      db.select().from(soundChangeSources),
    ]);

    const sourceMap = new Map(sourceRows.map((source) => [source.id, source]));
    const examplesByRule = groupBy(exampleRows, (example) => example.soundChangeId);
    const sourcesByRule = new Map<string, CatalogSource[]>();
    for (const link of changeSourceRows) {
      const source = sourceMap.get(link.sourceId);
      if (source) appendToMap(sourcesByRule, link.soundChangeId, source);
    }
    const rulesByTransition = new Map<string, CatalogRule[]>();
    for (const rule of ruleRows) {
      appendToMap(rulesByTransition, rule.transitionId, {
        ...rule,
        examples: examplesByRule.get(rule.id) ?? [],
        sources: sourcesByRule.get(rule.id) ?? [],
      });
    }
    const sourcesByTransition = new Map<string, CatalogSource[]>();
    for (const link of transitionSourceRows) {
      const source = sourceMap.get(link.sourceId);
      if (source) appendToMap(sourcesByTransition, link.transitionId, source);
    }

    const nodeNameMap = new Map(nodeRows.map((node) => [node.id, node.name]));
    const hydratedTransitions: CatalogTransition[] = transitionRows.map((transition) => ({
      ...transition,
      sourceName: nodeNameMap.get(transition.sourceNodeId) ?? "Unknown stage",
      targetName: nodeNameMap.get(transition.targetNodeId) ?? "Unknown stage",
      rules: rulesByTransition.get(transition.id) ?? [],
      sources: sourcesByTransition.get(transition.id) ?? [],
    }));
    const entriesByNode = new Map<string, CatalogTransition[]>();
    for (const transition of hydratedTransitions) {
      appendToMap(entriesByNode, transition.sourceNodeId, transition);
    }

    const hydratedNodes = nodeRows.map<CatalogNode>((node) => ({
      ...node,
      children: [],
      entries: entriesByNode.get(node.id) ?? [],
    }));
    const nodeMap = new Map(hydratedNodes.map((node) => [node.id, node]));
    const roots: CatalogNode[] = [];
    for (const node of hydratedNodes) {
      const parent = node.parentId ? nodeMap.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return {
      roots,
      nodes: hydratedNodes,
      transitions: hydratedTransitions,
      demo: [...nodeRows, ...transitionRows, ...sourceRows].some((record) => record.isDemo),
      databaseAvailable: true,
    };
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "catalog_query_failed", message: error instanceof Error ? error.message : "Unknown error" }));
    return { roots: [], nodes: [], transitions: [], demo: false, databaseAvailable: false };
  }
}

export async function getTransitionBySlug(slug: string): Promise<CatalogTransition | undefined> {
  const catalog = await getCatalog();
  return catalog.transitions.find((entry) => entry.slug === slug);
}

export async function getLineageBySlug(slug: string): Promise<CatalogNode | undefined> {
  const catalog = await getCatalog();
  return catalog.nodes.find((node) => node.slug === slug);
}

export async function getHistory(limit = 100) {
  await connection();
  try {
    return await db.select().from(revisionEvents).orderBy(desc(revisionEvents.createdAt)).limit(limit);
  } catch {
    return [];
  }
}

export async function resolveSlugAlias(entityType: "lineage" | "transition", oldSlug: string): Promise<string | null> {
  await connection();
  try {
    const [alias] = await db.select().from(slugAliases).where(and(eq(slugAliases.entityType, entityType), eq(slugAliases.oldSlug, oldSlug))).limit(1);
    if (!alias) return null;
    if (entityType === "lineage") return (await db.select({ slug: lineageNodes.slug }).from(lineageNodes).where(eq(lineageNodes.id, alias.entityId)).limit(1))[0]?.slug ?? null;
    return (await db.select({ slug: transitions.slug }).from(transitions).where(eq(transitions.id, alias.entityId)).limit(1))[0]?.slug ?? null;
  } catch { return null; }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) appendToMap(result, key(item), item);
  return result;
}

function appendToMap<T>(map: Map<string, T[]>, key: string, item: T): void {
  const list = map.get(key) ?? [];
  list.push(item);
  map.set(key, list);
}
