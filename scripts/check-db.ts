import { sql } from "../src/db";

async function main() {
  try {
    const [connection] = await sql<{ database: string; username: string }[]>`select current_database() as database, current_user as username`;
    const [tables] = await sql<{ transitions: string | null; soundChanges: string | null }[]>`select to_regclass('public.transitions') as transitions, to_regclass('public.sound_changes') as "soundChanges"`;
    const [count] = await sql<{ count: string }[]>`select count(*)::text as count from transitions`;
    console.log(JSON.stringify({ status: "ready", ...connection, tables, transitionCount: count.count }));
  } catch (error) {
    console.error(JSON.stringify({ status: "unavailable", message: error instanceof Error ? error.message : String(error), cause: error instanceof Error && error.cause ? String(error.cause) : undefined }));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
