import { redirect } from "next/navigation";
import { getReviewItems } from "@/db/queries";
import { requireModerator } from "@/lib/auth";
import { reviewCatalogItemAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ReviewChangesPage() {
  const moderator = await requireModerator();
  if (moderator.role !== "admin") redirect("/moderation");
  const items = await getReviewItems();
  const pending = items.filter((item) => item.status === "pending");
  const reviewed = items.filter((item) => item.status !== "pending").slice(0, 30);

  return <main className="review-page">
    <header className="review-hero">
      <div><p className="eyebrow">Editorial review</p><h1>Review changes</h1><p>Approve new catalogue material or reject it without losing the audit record.</p></div>
      <div className="review-count" aria-label={`${pending.length} pending changes`}><strong>{pending.length}</strong><span>awaiting review</span></div>
    </header>
    <section aria-labelledby="pending-heading">
      <div className="review-section-heading"><div><p className="eyebrow">Queue</p><h2 id="pending-heading">Pending additions</h2></div><span>{pending.length} {pending.length === 1 ? "item" : "items"}</span></div>
      {pending.length === 0 ? <div className="review-empty"><span aria-hidden="true">✓</span><h3>All caught up</h3><p>There are no moderator additions waiting for a decision.</p></div> : <div className="review-grid">{pending.map((item) => <ReviewCard key={`${item.entityType}-${item.id}`} item={item} />)}</div>}
    </section>
    {reviewed.length > 0 && <section className="reviewed-section" aria-labelledby="reviewed-heading"><div className="review-section-heading"><div><p className="eyebrow">Audit trail</p><h2 id="reviewed-heading">Recent decisions</h2></div></div><div className="reviewed-list">{reviewed.map((item) => <article key={`${item.entityType}-${item.id}`} className="reviewed-row"><Status status={item.status} /><div><strong>{item.title}</strong><p>{label(item.entityType)} · submitted by {item.submittedBy}</p></div><time dateTime={(item.reviewedAt ?? item.createdAt).toISOString()}>{(item.reviewedAt ?? item.createdAt).toLocaleDateString("en", { dateStyle: "medium" })}</time></article>)}</div></section>}
  </main>;
}

function ReviewCard({ item }: { item: Awaited<ReturnType<typeof getReviewItems>>[number] }) {
  return <article className="review-card"><header><span className="review-type">{label(item.entityType)}</span><Status status={item.status} /></header>
    <h3>{item.title}</h3><p className="review-context">{item.context}</p>
    <dl><div><dt>Submitted by</dt><dd>{item.submittedBy}</dd></div><div><dt>Submitted</dt><dd><time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></dd></div></dl>
    <div className="review-actions"><DecisionForm item={item} decision="approved" label="Approve" /><DecisionForm item={item} decision="rejected" label="Reject" /></div>
  </article>;
}

function DecisionForm({ item, decision, label: text }: { item: Awaited<ReturnType<typeof getReviewItems>>[number]; decision: "approved" | "rejected"; label: string }) {
  return <form action={reviewCatalogItemAction}><input type="hidden" name="entityType" value={item.entityType} /><input type="hidden" name="entityId" value={item.id} /><input type="hidden" name="decision" value={decision} /><button type="submit" className={`${decision === "approved" ? "approve" : "reject"}-button`}>{text}</button></form>;
}

function Status({ status }: { status: "pending" | "approved" | "rejected" }) { return <span className={`review-status review-status--${status}`}>{status}</span>; }
function label(type: "language" | "sound_change") { return type === "language" ? "Language or stage" : "Sound change"; }
