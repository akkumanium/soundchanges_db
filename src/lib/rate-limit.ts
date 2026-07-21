import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema";

export async function checkRateLimit(ip: string, scope: string, limit: number, windowMinutes: number): Promise<{ allowed: boolean; hash: string }> {
  const secret = process.env.RATE_LIMIT_SECRET ?? "development-only-rate-limit-secret";
  const day = new Date().toISOString().slice(0, 10);
  const hash = createHmac("sha256", secret).update(`${day}:${ip}`).digest("hex");
  const key = `${scope}:${hash}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMinutes * 60_000);
  await db.insert(rateLimitBuckets).values({ key, count: 1, windowStartedAt: now, expiresAt }).onConflictDoUpdate({
    target: rateLimitBuckets.key,
    set: {
      count: sql`case when ${rateLimitBuckets.expiresAt} < now() then 1 else ${rateLimitBuckets.count} + 1 end`,
      windowStartedAt: sql`case when ${rateLimitBuckets.expiresAt} < now() then now() else ${rateLimitBuckets.windowStartedAt} end`,
      expiresAt: sql`case when ${rateLimitBuckets.expiresAt} < now() then ${expiresAt.toISOString()}::timestamptz else ${rateLimitBuckets.expiresAt} end`,
    },
  });
  const [bucket] = await db.select().from(rateLimitBuckets).where(eq(rateLimitBuckets.key, key)).limit(1);
  return { allowed: Boolean(bucket && bucket.count <= limit), hash };
}
