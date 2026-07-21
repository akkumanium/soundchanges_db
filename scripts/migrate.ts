import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "../src/db";

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied.");
  await sql.end();
}

main().catch(async (error) => { console.error(error); await sql.end(); process.exitCode = 1; });
