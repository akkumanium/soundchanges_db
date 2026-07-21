import Link from "next/link";
export default function NotFound() { return <div className="page-shell content-page"><p className="eyebrow">Not found</p><h1>This record does not exist.</h1><p>It may have been renamed, removed, or not yet published.</p><p><Link href="/browse">Browse the catalog</Link></p></div>; }
