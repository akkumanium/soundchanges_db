import { sql } from "@/db";

export async function GET() {
  try {
    await sql`select 1`;
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
