import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogChangeItems,
  catalogChanges,
  examples,
  lineageNodes,
  slugAliases,
  soundChanges,
  soundChangeSources,
  sources,
  transitions,
  transitionSources,
} from "@/db/schema";

export type CatalogTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SnapshotRow = Record<string, unknown>;
type SnapshotItem = { tableName: TableName; rowKey: string; beforeSnapshot: SnapshotRow | null; afterSnapshot: SnapshotRow | null };
type TableName = keyof typeof tableOrder;
type DatabaseSnapshotRow = { tableName: TableName; rowKey: string; snapshot: Record<string, unknown> };
type DatabaseSnapshotDelta = { tableName: TableName; rowKey: string; beforeSnapshot: Record<string, unknown> | null; afterSnapshot: Record<string, unknown> | null };

const tableOrder = {
  lineage_nodes: 0,
  transitions: 1,
  sound_changes: 2,
  sources: 3,
  examples: 4,
  transition_sources: 5,
  sound_change_sources: 6,
  slug_aliases: 7,
} as const;

// Keep full snapshots inside Postgres. Only rows that actually changed cross
// the Neon proxy, which preserves complete audit/revert data without fetching
// the entire catalogue twice for every edit.
const catalogRowsSql = sql`
  select 'lineage_nodes'::text as table_name, id::text as row_key, to_jsonb(lineage_nodes) as snapshot from lineage_nodes
  union all select 'transitions', id::text, to_jsonb(transitions) from transitions
  union all select 'sound_changes', id::text, to_jsonb(sound_changes) from sound_changes
  union all select 'sources', id::text, to_jsonb(sources) from sources
  union all select 'examples', id::text, to_jsonb(examples) from examples
  union all select 'transition_sources', transition_id::text || ':' || source_id::text, to_jsonb(transition_sources) from transition_sources
  union all select 'sound_change_sources', sound_change_id::text || ':' || source_id::text, to_jsonb(sound_change_sources) from sound_change_sources
  union all select 'slug_aliases', id::text, to_jsonb(slug_aliases) from slug_aliases
`;

export async function auditedCatalogMutation<T>(
  moderatorId: string,
  action: string,
  summary: string,
  mutate: (tx: CatalogTransaction) => Promise<T>,
  revertsChangeId?: string,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Serialize catalog writes so a concurrent transaction cannot be attributed
    // to the wrong moderator while the before/after snapshots are collected.
    await tx.execute(sql`select pg_advisory_xact_lock(16841001)`);
    await captureCatalogBefore(tx);
    const result = await mutate(tx);
    const items = await captureCatalogChanges(tx);
    if (items.length) {
      const [change] = await tx.insert(catalogChanges).values({ moderatorId, action, summary, revertsChangeId }).returning({ id: catalogChanges.id });
      await tx.insert(catalogChangeItems).values(items.map((item) => ({ changeId: change.id, ...item })));
    }
    return result;
  });
}

export async function revertCatalogChange(changeId: string, moderatorId: string): Promise<void> {
  const [change] = await db.select().from(catalogChanges).where(eq(catalogChanges.id, changeId)).limit(1);
  if (!change) throw new Error("This history entry does not exist.");
  const [alreadyReverted] = await db.select({ id: catalogChanges.id }).from(catalogChanges).where(eq(catalogChanges.revertsChangeId, changeId)).limit(1);
  if (alreadyReverted) throw new Error("This change has already been reverted.");
  const items = (await db.select().from(catalogChangeItems).where(eq(catalogChangeItems.changeId, changeId))) as Array<typeof catalogChangeItems.$inferSelect & SnapshotItem>;
  if (!items.length) throw new Error("This legacy history entry has no restorable payload.");

  await auditedCatalogMutation(moderatorId, "revert", `Reverted: ${change.summary}`, async (tx) => {
    const current = await captureCatalogRows(tx, items);
    for (const item of items) {
      const row = current.get(item.tableName)?.get(item.rowKey) ?? null;
      if (!snapshotMatches(row, item.afterSnapshot)) throw new Error(`Cannot revert because ${item.tableName} ${item.rowKey} has changed since this edit.`);
    }

    const restoringDeleted = sortItems(items.filter((item) => item.beforeSnapshot && !item.afterSnapshot), false);
    const restoringUpdates = items.filter((item) => item.beforeSnapshot && item.afterSnapshot);
    const removing = sortItems(items.filter((item) => !item.beforeSnapshot), true);
    for (const item of restoringDeleted) await upsertRow(tx, item.tableName, reviveDates(item.beforeSnapshot!));
    for (const item of restoringUpdates) await updateRow(tx, item.tableName, item.rowKey, reviveDates(item.beforeSnapshot!));
    for (const item of removing) await deleteRow(tx, item.tableName, item.rowKey);
  }, changeId);
}

async function captureCatalogBefore(tx: CatalogTransaction): Promise<void> {
  await tx.execute(sql`create temporary table catalog_audit_before on commit drop as ${catalogRowsSql}`);
}

async function captureCatalogChanges(tx: CatalogTransaction): Promise<SnapshotItem[]> {
  const rows = await tx.execute(sql`
    with after_rows as (${catalogRowsSql})
    select
      coalesce(before_rows.table_name, after_rows.table_name) as "tableName",
      coalesce(before_rows.row_key, after_rows.row_key) as "rowKey",
      before_rows.snapshot as "beforeSnapshot",
      after_rows.snapshot as "afterSnapshot"
    from catalog_audit_before before_rows
    full outer join after_rows using (table_name, row_key)
    where before_rows.snapshot is distinct from after_rows.snapshot
  `) as unknown as DatabaseSnapshotDelta[];
  return rows.map(snapshotDeltaFromDatabase);
}

async function captureCatalogRows(tx: CatalogTransaction, items: SnapshotItem[]) {
  const wanted = JSON.stringify(items.map(({ tableName, rowKey }) => ({ tableName, rowKey })));
  const rows = await tx.execute(sql`
    with catalog_rows as (${catalogRowsSql}),
    wanted as (
      select * from jsonb_to_recordset(${wanted}::jsonb) as requested("tableName" text, "rowKey" text)
    )
    select catalog_rows.table_name as "tableName", catalog_rows.row_key as "rowKey", catalog_rows.snapshot
    from catalog_rows
    inner join wanted on wanted."tableName" = catalog_rows.table_name and wanted."rowKey" = catalog_rows.row_key
  `) as unknown as DatabaseSnapshotRow[];
  const result = new Map<TableName, Map<string, SnapshotRow>>();
  for (const row of rows) {
    const tableRows = result.get(row.tableName) ?? new Map<string, SnapshotRow>();
    tableRows.set(row.rowKey, snapshotFromDatabase(row.snapshot));
    result.set(row.tableName, tableRows);
  }
  return result;
}

export function snapshotDeltaFromDatabase(delta: DatabaseSnapshotDelta): SnapshotItem {
  const beforeSnapshot = delta.beforeSnapshot ? snapshotFromDatabase(delta.beforeSnapshot) : null;
  const afterSnapshot = delta.afterSnapshot ? snapshotFromDatabase(delta.afterSnapshot) : null;
  if (beforeSnapshot && afterSnapshot) {
    const keys = [...new Set([...Object.keys(beforeSnapshot), ...Object.keys(afterSnapshot)])]
      .filter((key) => !sameSnapshot(beforeSnapshot[key], afterSnapshot[key]));
    return { tableName: delta.tableName, rowKey: delta.rowKey, beforeSnapshot: pickFields(beforeSnapshot, keys), afterSnapshot: pickFields(afterSnapshot, keys) };
  }
  return { tableName: delta.tableName, rowKey: delta.rowKey, beforeSnapshot, afterSnapshot };
}

export function snapshotFromDatabase(row: Record<string, unknown>): SnapshotRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const applicationKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    const applicationValue = ["createdAt", "updatedAt", "reviewedAt"].includes(applicationKey) && typeof value === "string" ? new Date(value) : value;
    return [applicationKey, applicationValue];
  }));
}

export function sameSnapshot(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function snapshotMatches(current: SnapshotRow | null, expected: SnapshotRow | null) {
  if (!expected) return current === null;
  if (!current) return false;
  return Object.entries(expected).every(([key, value]) => sameSnapshot(current[key], value));
}

function pickFields(row: SnapshotRow, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, row[key]]));
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

function reviveDates(row: SnapshotRow): SnapshotRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ["createdAt", "updatedAt", "reviewedAt"].includes(key) && typeof value === "string" ? new Date(value) : value]));
}

function sortItems<T extends SnapshotItem>(items: T[], reverse: boolean): T[] {
  const lineageItems = new Map(items.filter((item) => item.tableName === "lineage_nodes").map((item) => [item.rowKey, item]));
  const lineageDepth = (item: T, seen = new Set<string>()): number => {
    if (seen.has(item.rowKey)) return 0;
    seen.add(item.rowKey);
    const snapshot = (reverse ? item.afterSnapshot : item.beforeSnapshot) ?? {};
    const parent = typeof snapshot.parentId === "string" ? lineageItems.get(snapshot.parentId) : undefined;
    return parent ? 1 + lineageDepth(parent as T, seen) : 0;
  };
  const sorted = [...items].sort((left, right) => {
    const order = tableOrder[left.tableName] - tableOrder[right.tableName];
    if (order) return reverse ? -order : order;
    if (left.tableName === "lineage_nodes") {
      const depthOrder = lineageDepth(left) - lineageDepth(right);
      if (depthOrder) return reverse ? -depthOrder : depthOrder;
    }
    return left.rowKey.localeCompare(right.rowKey);
  });
  return sorted;
}

async function deleteRow(tx: CatalogTransaction, tableName: TableName, rowKey: string) {
  if (tableName === "lineage_nodes") return void await tx.delete(lineageNodes).where(eq(lineageNodes.id, rowKey));
  if (tableName === "transitions") return void await tx.delete(transitions).where(eq(transitions.id, rowKey));
  if (tableName === "sound_changes") return void await tx.delete(soundChanges).where(eq(soundChanges.id, rowKey));
  if (tableName === "sources") return void await tx.delete(sources).where(eq(sources.id, rowKey));
  if (tableName === "examples") return void await tx.delete(examples).where(eq(examples.id, rowKey));
  if (tableName === "slug_aliases") return void await tx.delete(slugAliases).where(eq(slugAliases.id, rowKey));
  const [first, second] = rowKey.split(":");
  if (tableName === "transition_sources") return void await tx.delete(transitionSources).where(and(eq(transitionSources.transitionId, first), eq(transitionSources.sourceId, second)));
  return void await tx.delete(soundChangeSources).where(and(eq(soundChangeSources.soundChangeId, first), eq(soundChangeSources.sourceId, second)));
}

async function upsertRow(tx: CatalogTransaction, tableName: TableName, row: SnapshotRow) {
  if (tableName === "lineage_nodes") return void await tx.insert(lineageNodes).values(row as typeof lineageNodes.$inferInsert).onConflictDoUpdate({ target: lineageNodes.id, set: row });
  if (tableName === "transitions") return void await tx.insert(transitions).values(row as typeof transitions.$inferInsert).onConflictDoUpdate({ target: transitions.id, set: row });
  if (tableName === "sound_changes") return void await tx.insert(soundChanges).values(row as typeof soundChanges.$inferInsert).onConflictDoUpdate({ target: soundChanges.id, set: row });
  if (tableName === "sources") return void await tx.insert(sources).values(row as typeof sources.$inferInsert).onConflictDoUpdate({ target: sources.id, set: row });
  if (tableName === "examples") return void await tx.insert(examples).values(row as typeof examples.$inferInsert).onConflictDoUpdate({ target: examples.id, set: row });
  if (tableName === "slug_aliases") return void await tx.insert(slugAliases).values(row as typeof slugAliases.$inferInsert).onConflictDoUpdate({ target: slugAliases.id, set: row });
  if (tableName === "transition_sources") return void await tx.insert(transitionSources).values(row as typeof transitionSources.$inferInsert).onConflictDoNothing();
  return void await tx.insert(soundChangeSources).values(row as typeof soundChangeSources.$inferInsert).onConflictDoNothing();
}

async function updateRow(tx: CatalogTransaction, tableName: TableName, rowKey: string, row: SnapshotRow) {
  if (tableName === "lineage_nodes") return void await tx.update(lineageNodes).set(row).where(eq(lineageNodes.id, rowKey));
  if (tableName === "transitions") return void await tx.update(transitions).set(row).where(eq(transitions.id, rowKey));
  if (tableName === "sound_changes") return void await tx.update(soundChanges).set(row).where(eq(soundChanges.id, rowKey));
  if (tableName === "sources") return void await tx.update(sources).set(row).where(eq(sources.id, rowKey));
  if (tableName === "examples") return void await tx.update(examples).set(row).where(eq(examples.id, rowKey));
  if (tableName === "slug_aliases") return void await tx.update(slugAliases).set(row).where(eq(slugAliases.id, rowKey));
  throw new Error(`Unsupported update in ${tableName} ${rowKey}.`);
}
