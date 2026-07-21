import { getHistory } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const events = await getHistory();
  return <div className="page-shell content-page"><p className="eyebrow">Public record</p><h1>Revision history</h1><p>Every moderator catalog edit is recorded here.</p>{events.length ? <ol className="history-list">{events.map((event) => <li key={event.id}><strong>{event.summary}</strong><br /><span>{event.action} · {event.entityType}</span><br /><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("en")}</time>{event.contributorCredit && <> · credited to {event.contributorCredit}</>}</li>)}</ol> : <p className="empty-state">No changes have been published yet.</p>}</div>;
}
