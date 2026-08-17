import { redirect } from "next/navigation";
import { RevertChangeButton } from "@/components/RevertChangeButton";
import { getCatalog, getCatalogHistory } from "@/db/queries";
import { requireModerator } from "@/lib/auth";
import { buildHistoryReferences, changedHistoryFields, describeHistoryItem, historyOperation } from "@/lib/catalog-history";

export const dynamic = "force-dynamic";

export default async function CatalogHistoryPage() {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") redirect("/moderation");
  const [changes, catalog] = await Promise.all([getCatalogHistory(200), getCatalog()]);
  const references = buildHistoryReferences(changes, catalog);

  return <main className="history-page">
    <header className="page-intro page-intro--small"><p className="eyebrow">Administration</p><h1>Catalog history</h1><p>Changes are shown with catalog names and readable field values. Reverting creates a new entry and never erases the audit trail.</p></header>
    {changes.length === 0 ? <p className="empty-state">No audited catalog changes yet.</p> : <div className="history-list">{changes.map((change) => <article className="history-entry" key={change.id}>
      <header><div><strong>{change.summary}</strong><p>{change.action} · {change.username} · <time dateTime={change.createdAt.toISOString()}>{change.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></p></div><span>{change.items.length} affected {change.items.length === 1 ? "record" : "records"}</span></header>
      <details><summary>Inspect changes</summary><div className="history-items">{change.items.map((item) => {
        const operation = historyOperation(item);
        return <section className="history-item" key={item.id}>
          <header><h3>{describeHistoryItem(item, references)}</h3><span className={`history-operation history-operation--${operation.toLowerCase()}`}>{operation}</span></header>
          <table className="history-diff"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{changedHistoryFields(item, references).map((field) => <tr key={field.key}><th scope="row">{field.label}</th><td>{field.before}</td><td>{field.after}</td></tr>)}</tbody></table>
        </section>;
      })}</div></details>
      <footer>{change.revertsChangeId ? <span>Reverts an earlier change</span> : change.reverted ? <span>Already reverted</span> : <RevertChangeButton changeId={change.id} />}</footer>
    </article>)}</div>}
  </main>;
}
