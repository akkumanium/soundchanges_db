import { redirect } from "next/navigation";
import { getCatalogHistory } from "@/db/queries";
import { requireModerator } from "@/lib/auth";
import { RevertChangeButton } from "@/components/RevertChangeButton";

export const dynamic = "force-dynamic";

export default async function CatalogHistoryPage() {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") redirect("/moderation");
  const changes = await getCatalogHistory(200);
  return <main className="history-page">
    <header className="page-intro page-intro--small"><p className="eyebrow">Administration</p><h1>Catalog history</h1><p>Every affected row is recorded. Reverting creates a new entry and never erases the audit trail.</p></header>
    {changes.length === 0 ? <p className="empty-state">No audited catalog changes yet.</p> : <div className="history-list">{changes.map((change) => <article className="history-entry" key={change.id}>
      <header><div><strong>{change.summary}</strong><p>{change.action} · {change.username} · <time dateTime={change.createdAt.toISOString()}>{change.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></p></div><span>{change.items.length} affected {change.items.length === 1 ? "row" : "rows"}</span></header>
      <details><summary>Inspect exact changes</summary><div className="history-items">{change.items.map((item) => <section key={item.id}><h3>{label(item.tableName)} <code>{item.rowKey}</code></h3><pre className="diff">{formatDiff(item.beforeSnapshot, item.afterSnapshot)}</pre></section>)}</div></details>
      <footer>{change.revertsChangeId ? <span>Reverts an earlier change</span> : change.reverted ? <span>Already reverted</span> : <RevertChangeButton changeId={change.id} />}</footer>
    </article>)}</div>}
  </main>;
}

function label(tableName: string) { return tableName.replaceAll("_", " "); }

function formatDiff(before: unknown, after: unknown) {
  if (before === null) return `Created\n${JSON.stringify(after, null, 2)}`;
  if (after === null) return `Deleted\n${JSON.stringify(before, null, 2)}`;
  const left = before as Record<string, unknown>; const right = after as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
  return keys.map((key) => `${key}:\n- ${JSON.stringify(left[key])}\n+ ${JSON.stringify(right[key])}`).join("\n");
}
