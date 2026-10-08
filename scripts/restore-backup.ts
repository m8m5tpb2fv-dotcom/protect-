/**
 * Restores a database backup made by src/server/backup (the .rydb file the bot sends to admins).
 *
 *   BACKUP_PASSWORD=… DATABASE_URL=… npx tsx scripts/restore-backup.ts ryadom-backup-2026-10-08_23-30.rydb --yes
 *
 * The target database must be migrated first (npm run db:migrate) and empty — the script refuses to
 * overwrite a database that already has users unless --force is given (then all tables are emptied).
 * Tables are loaded parents-first, so no superuser rights are needed.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { decryptBackup } from "../src/server/backup/format";

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const yes = process.argv.includes("--yes");
  const force = process.argv.includes("--force");
  if (!file || !yes) throw new Error("Usage: restore-backup.ts <file.rydb> --yes [--force]");
  const password = process.env.BACKUP_PASSWORD;
  if (!password) throw new Error("Set BACKUP_PASSWORD");
  const payload = decryptBackup(readFileSync(file), password);
  console.log(`backup of ${payload.createdAt}: ${Object.keys(payload.tables).length} tables`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const c = await pool.connect();
  try {
    const existing = new Set((await c.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'")).rows.map((r) => r.t));
    const { rows: [{ n }] } = await c.query<{ n: number }>("select count(*)::int n from users");
    if (n > 0 && !force) throw new Error(`Target database already has ${n} users. Use an empty database or pass --force to replace everything.`);
    // parents before children: order tables by their foreign keys (self-references are fine row-wise
    // only if parents come first, so rows of a self-referencing table are inserted in one statement)
    const fks = (await c.query<{ child: string; parent: string }>(
      "select distinct cl.relname child, pl.relname parent from pg_constraint k join pg_class cl on cl.oid = k.conrelid join pg_class pl on pl.oid = k.confrelid join pg_namespace n on n.oid = cl.relnamespace where k.contype = 'f' and n.nspname = 'public' and cl.relname <> pl.relname",
    )).rows;
    const order: string[] = [];
    const pending = new Set(Object.keys(payload.tables).filter((t) => existing.has(t)));
    while (pending.size) {
      const ready = [...pending].filter((t) => !fks.some((f) => f.child === t && pending.has(f.parent)));
      if (!ready.length) throw new Error(`Circular foreign keys between: ${[...pending].join(", ")}`);
      for (const t of ready.sort()) {
        order.push(t);
        pending.delete(t);
      }
    }
    for (const t of Object.keys(payload.tables)) if (!existing.has(t)) console.warn(`! skipped ${t}: no such table (run migrations?)`);

    await c.query("begin");
    if (force) await c.query(`truncate ${[...existing].map((t) => `"${t}"`).join(", ")} restart identity cascade`);
    for (const table of order) {
      const rows = payload.tables[table];
      if (rows.length) await c.query(`insert into "${table}" select * from json_populate_recordset(null::"${table}", $1::json)`, [JSON.stringify(rows)]);
      console.log(`✓ ${table}: ${rows.length}`);
    }
    // serial columns continue after the restored ids
    const seqs = await c.query<{ t: string; col: string; seq: string }>(
      "select table_name t, column_name col, pg_get_serial_sequence(format('%I', table_name), column_name) seq from information_schema.columns where table_schema = 'public' and pg_get_serial_sequence(format('%I', table_name), column_name) is not null",
    );
    for (const s of seqs.rows) await c.query(`select setval($1, coalesce((select max("${s.col}") from "${s.t}"), 0) + 1, false)`, [s.seq]);
    await c.query("commit");
    console.log("✓ restore complete");
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
