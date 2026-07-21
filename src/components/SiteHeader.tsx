import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/">CASC</Link>
        <nav aria-label="Primary navigation">
          <Link href="/browse">Browse</Link>
          <Link href="/search">Search</Link>
          <Link href="/about">About</Link>
        </nav>
      </div>
    </header>
  );
}
