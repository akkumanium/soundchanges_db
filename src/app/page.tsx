import Link from "next/link";
import { DatabaseNotice, DemoNotice } from "@/components/StatusNotices";
import { getCatalog } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getCatalog();
  const ruleCount = catalog.transitions.reduce((count, entry) => count + entry.rules.length, 0);
  return <div className="page-shell home">
    {catalog.demo && <DemoNotice />}{!catalog.databaseAvailable && <DatabaseNotice />}
    <header className="page-intro"><p className="eyebrow"></p><h1>CASC</h1><p className="lede">Corpus of Attested Sound Changes — a searchable, reviewed index of sound changes attested across the world’s languages.</p></header>
    <form className="search-box" action="/search" role="search"><label htmlFor="home-input">Search exact sound correspondences</label><div className="search-box__fields"><input id="home-input" name="input" type="search" placeholder="First sound, e.g. t" /><input name="output" type="search" placeholder="Second sound, e.g. s" /><button type="submit">Search</button></div></form>
    <dl className="catalog-counts"><div><dt>Entries</dt><dd>{catalog.transitions.length}</dd></div><div><dt>Sound changes</dt><dd>{ruleCount}</dd></div></dl>
    <Link className="button-link" href="/browse">Browse sound changes</Link>
  </div>;
}
