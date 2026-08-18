import Link from "next/link";
import { verifyAllCatalogChangesAction, verifyCatalogChangeAction } from "@/app/moderation/actions";
import type { Catalog } from "@/db/queries";
import {
  buildHistoryReferences,
  changedHistoryFields,
  describeHistoryItem,
  historyOperation,
  type HistoryItem,
} from "@/lib/catalog-history";

type BrowseChange = {
  id: string;
  action: string;
  summary: string;
  username: string;
  createdAt: Date;
  items: Array<HistoryItem & { id: string }>;
};

export function BrowseChangeHighlights({ changes, catalog }: { changes: BrowseChange[]; catalog: Catalog }) {
  if (changes.length === 0) return <section className="browse-changes browse-changes--clear" aria-labelledby="browse-changes-heading">
    <div><p className="eyebrow">Administrator view</p><h2 id="browse-changes-heading">All catalog changes verified</h2><p>New catalog edits will appear here for verification.</p></div>
    <Link href="/moderation/history">View complete history</Link>
  </section>;
  const references = buildHistoryReferences(changes, catalog);

  return <section className="browse-changes" aria-labelledby="browse-changes-heading">
    <header className="browse-changes__header">
      <div><p className="eyebrow">Administrator view</p><h2 id="browse-changes-heading">Catalog changes</h2><p>Every recorded addition, edit, and deletion is highlighted below. This section is only visible to administrators.</p></div>
      <div className="browse-changes__actions"><Link href="/moderation/history">History and revert tools</Link><form action={verifyAllCatalogChangesAction}><button type="submit">Verify all</button></form></div>
    </header>
    <div className="browse-changes__legend" aria-label="Change highlight legend">
      <span className="browse-changes__key browse-changes__key--created">Added</span>
      <span className="browse-changes__key browse-changes__key--changed">Changed</span>
      <span className="browse-changes__key browse-changes__key--deleted">Deleted</span>
    </div>
    <div className="browse-changes__list">{changes.map((change) => <article className="browse-change" key={change.id}>
      <header><div><h3>{change.summary}</h3><p>{change.action} · {change.username} · <time dateTime={change.createdAt.toISOString()}>{change.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></p></div><div className="browse-change__verify"><span>{change.items.length} {change.items.length === 1 ? "record" : "records"}</span><form action={verifyCatalogChangeAction}><input type="hidden" name="changeId" value={change.id} /><button type="submit">Verify</button></form></div></header>
      <div className="browse-change__items">{change.items.map((item) => {
        const operation = historyOperation(item);
        return <section className={`browse-change-item browse-change-item--${operation.toLowerCase()}`} key={item.id}>
          <header><h4>{describeHistoryItem(item, references)}</h4><span>{operation}</span></header>
          <dl>{changedHistoryFields(item, references).map((field) => <div key={field.key}>
            <dt>{field.label}</dt>
            {operation !== "Created" && <dd className="browse-change-item__before"><span>{operation === "Deleted" ? "Removed" : "Before"}</span>{field.before}</dd>}
            {operation !== "Deleted" && <dd className="browse-change-item__after"><span>{operation === "Created" ? "Added" : "After"}</span>{field.after}</dd>}
          </div>)}</dl>
        </section>;
      })}</div>
    </article>)}</div>
  </section>;
}
