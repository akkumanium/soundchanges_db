import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/">
          CASC <span className="wordmark__beta">beta</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a className="discord-link" href="https://discord.gg/enKKuKJruc" aria-label="Discord">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path fill="currentColor" d="M19.5 5.34A17.3 17.3 0 0 0 15.44 4l-.5 1.02a15.9 15.9 0 0 0-5.87 0L8.56 4A17.4 17.4 0 0 0 4.5 5.35C1.93 9.12 1.24 12.8 1.59 16.43a16.4 16.4 0 0 0 4.98 2.5l1.2-1.65a10.6 10.6 0 0 1-1.88-.9l.46-.35a12.4 12.4 0 0 0 11.3 0l.46.36c-.6.35-1.24.65-1.88.89l1.2 1.65a16.3 16.3 0 0 0 4.98-2.5c.42-4.2-.72-7.84-2.91-11.09ZM8.51 14.2c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27 1.13 0 2.02 1.03 2 2.27 0 1.25-.88 2.27-2 2.27Zm6.98 0c-1.1 0-2-1.02-2-2.27 0-1.25.88-2.27 2-2.27 1.13 0 2.02 1.03 2 2.27 0 1.25-.87 2.27-2 2.27Z" />
            </svg>
          </a>
          <Link href="/browse">Browse</Link>
          <Link href="/search">Search</Link>
          <Link href="/about">About</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
