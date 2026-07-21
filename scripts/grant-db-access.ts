import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/diachronica";
  const sql = postgres(connectionString, { max: 1 });
  try {
    await sql.unsafe("GRANT USAGE ON SCHEMA public TO diachronica");
    await sql.unsafe("GRANT USAGE, CREATE ON SCHEMA drizzle TO diachronica");
    await sql.unsafe("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO diachronica");
    await sql.unsafe("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA drizzle TO diachronica");
    await sql.unsafe("GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO diachronica");
    await sql.unsafe("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO diachronica");
    await sql.unsafe("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO diachronica");
    console.log("Database access granted to the application role.");
  } finally {
    await sql.end();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
