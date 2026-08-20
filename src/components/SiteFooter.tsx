import Link from "next/link";

export function SiteFooter() {
  const sourceUrl = process.env.SOURCE_CODE_URL ?? "https://github.com/";
  return (
    <footer className="site-footer">
      <div>
        <p>Sound-change data is available under <Link href="/license">CC BY-SA 4.0</Link>.</p>
        <p><a href={sourceUrl} rel="external">Source code</a> is licensed AGPL-3.0-only.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/conventions">Notation</Link>
      </nav>
    </footer>
  );
}
