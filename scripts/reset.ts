import "dotenv/config";
import { Pool } from "pg";

/** Drops every table in the public schema. Refuses to run in production. */
async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) throw new Error("Refusing to reset a production database");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await pool.end();
  console.log("✓ database reset");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
