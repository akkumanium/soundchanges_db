import { eq } from "drizzle-orm";
import { db, sql } from "../src/db";
import { moderators } from "../src/db/schema";
import { passwordHash } from "../src/lib/auth";

async function main() {
  const username = (process.argv[2] ?? process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";
  if (!/^[a-z0-9_.-]{3,64}$/.test(username) || password.length < 12) {
    console.error("Usage: pnpm admin:create <username> <password-of-at-least-12-characters>");
    process.exitCode = 1;
  } else {
    const [existing] = await db.select({ id: moderators.id }).from(moderators).where(eq(moderators.username, username)).limit(1);
    const passwordDigest = await passwordHash(password);
    if (existing) await db.update(moderators).set({ passwordHash: passwordDigest, role: "admin", disabled: false, updatedAt: new Date() }).where(eq(moderators.id, existing.id));
    else await db.insert(moderators).values({ username, passwordHash: passwordDigest, role: "admin" });
    console.log(`Administrator ${username} is ready.`);
  }
  await sql.end();
}

main().catch(async (error) => { console.error(error); await sql.end(); process.exitCode = 1; });
