import { lt } from "drizzle-orm";
import { db, sql } from "../src/db";
import { rateLimitBuckets, sessions } from "../src/db/schema";

async function main() {
  const now = new Date();
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.expiresAt, now));
  console.log("Expired operational data purged.");
  await sql.end();
}

main().catch(async (error) => { console.error(error); await sql.end(); process.exitCode = 1; });
