import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { moderators, sessions } from "@/db/schema";

const SESSION_COOKIE = "diachronica_session";
const SESSION_DAYS = 14;

export type Moderator = Pick<typeof moderators.$inferSelect, "id" | "username" | "role">;

export async function passwordHash(password: string): Promise<string> {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
}

export async function authenticate(username: string, password: string): Promise<Moderator | null> {
  const [account] = await db.select().from(moderators).where(eq(moderators.username, username.normalize("NFC").trim().toLowerCase())).limit(1);
  if (!account || account.disabled || !(await verify(account.passwordHash, password))) return null;
  return { id: account.id, username: account.username, role: account.role };
}

export async function createSession(moderatorId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ moderatorId, tokenHash: tokenHash(token), expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  jar.delete(SESSION_COOKIE);
}

export async function currentModerator(): Promise<Moderator | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: moderators.id, username: moderators.username, role: moderators.role, disabled: moderators.disabled })
    .from(sessions)
    .innerJoin(moderators, eq(sessions.moderatorId, moderators.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.disabled) return null;
  return { id: row.id, username: row.username, role: row.role };
}

export async function requireModerator(): Promise<Moderator> {
  const moderator = await currentModerator();
  if (!moderator) redirect("/moderation/login");
  return moderator;
}

function tokenHash(token: string): string {
  const secret = process.env.SESSION_SECRET ?? "development-only-session-secret-change-me";
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
