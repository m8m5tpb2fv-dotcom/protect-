import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { ensureAdmin, seedDemo, seedReference } from "../src/server/db/seed";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const onlyAdmin = process.argv.includes("--admin-only");
  if (!onlyAdmin) {
    await seedReference(db);
    console.log("✓ reference data (cities, districts, catalogue)");
  }
  const adminId = await ensureAdmin(db, process.env.ADMIN_EMAIL ?? "", process.env.ADMIN_PASSWORD ?? "");
  if (adminId) console.log(`✓ admin user: ${process.env.ADMIN_EMAIL}`);
  const withDemo = !onlyAdmin && (process.argv.includes("--demo") || process.env.DEMO_MODE === "true");
  if (withDemo) await seedDemo(db);
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
