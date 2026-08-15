import Link from "next/link";
import { logoutAction } from "../actions";
import { requireModerator } from "@/lib/auth";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const moderator = await requireModerator();
  return <div className="page-shell page-shell--wide"><nav className="section-heading" aria-label="Moderation"><h2>Moderation</h2><span><Link href="/moderation">Edit catalog</Link> · {moderator.role === "admin" && <><Link href="/moderation/history">History</Link> · <Link href="/moderation/accounts">Accounts</Link> · </>}<form action={logoutAction} style={{ display: "inline" }}><button className="button-secondary" type="submit">Sign out {moderator.username}</button></form></span></nav>{children}</div>;
}
