import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/diachronica";

export const sql = globalForDb.sql ?? postgres(connectionString, { max: process.env.NODE_ENV === "production" ? 10 : 3 });
export const db = drizzle(sql, { schema });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
