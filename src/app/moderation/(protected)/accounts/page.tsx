import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { moderators } from "@/db/schema";
import { requireModerator } from "@/lib/auth";
import { createModeratorAction, toggleModeratorAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ModeratorAccountsPage() {
  const current = await requireModerator(); if (current.role !== "admin") redirect("/moderation");
  const accounts = await db.select().from(moderators).orderBy(asc(moderators.username));
  return <section className="content-page"><p className="eyebrow">Administration</p><h1>Moderator accounts</h1><table className="moderation-table"><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{account.username}</td><td>{account.role}</td><td>{account.disabled ? "Disabled" : "Active"}</td><td>{account.id !== current.id && <form action={toggleModeratorAction}><input type="hidden" name="moderatorId" value={account.id} /><input type="hidden" name="disabled" value={String(!account.disabled)} /><button className="button-secondary" type="submit">{account.disabled ? "Enable" : "Disable"}</button></form>}</td></tr>)}</tbody></table><h2>Create account</h2><form action={createModeratorAction} className="contribution-form"><div className="form-grid"><div className="form-field"><label htmlFor="new-username">Username</label><input id="new-username" name="username" required /></div><div className="form-field"><label htmlFor="new-password">Temporary password</label><input id="new-password" name="password" type="password" minLength={12} required /></div><div className="form-field"><label htmlFor="new-role">Role</label><select id="new-role" name="role"><option value="moderator">Moderator</option><option value="admin">Administrator</option></select></div></div><button type="submit">Create account</button></form></section>;
}
