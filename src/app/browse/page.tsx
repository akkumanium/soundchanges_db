import { CatalogBrowse } from "@/components/LineageTree";
import { DatabaseNotice, DemoNotice } from "@/components/StatusNotices";
import { getCatalog, getCatalogHistory } from "@/db/queries";
import { currentModerator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const [catalog, moderator] = await Promise.all([getCatalog(), currentModerator()]);
  const changes = moderator?.role === "admin" && catalog.databaseAvailable ? await getCatalogHistory(undefined, true) : [];
  const reviewChanges = changes.filter((change) => !change.reverted);
  return (
    <div className="page-shell page-shell--wide">
      {catalog.demo && <DemoNotice />}
      {!catalog.databaseAvailable && <DatabaseNotice />}
      <header className="page-intro page-intro--small"><p className="eyebrow">Sound changes</p><h1>Browse</h1></header>
      {catalog.databaseAvailable ? <CatalogBrowse entries={catalog.transitions} nodes={catalog.nodes} canEdit={Boolean(moderator)} catalog={catalog} reviewChanges={moderator?.role === "admin" ? reviewChanges : []} /> : <p className="empty-state">The catalogue is unavailable.</p>}
    </div>
  );
}
