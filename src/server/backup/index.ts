import "server-only";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { adminActions, users } from "../db/schema";
import { env } from "../env";
import { log } from "../log";
import { encryptBackup, type BackupPayload } from "./format";

/*
 * Free off-site database backups (Railway volume backups need a paid plan).
 *
 * A backup is every table of the public schema as JSON (json_agg per table), gzipped and encrypted with
 * AES-256-GCM under a key derived from BACKUP_PASSWORD. The file is sent by the bot to every admin who
 * has Telegram linked. Without BACKUP_PASSWORD nothing is ever created: personal data never leaves the
 * server unencrypted. Restore: scripts/restore-backup.ts.
 */
const backupPassword = () => process.env.BACKUP_PASSWORD || env.BACKUP_PASSWORD;
export const backupEnabled = () => (backupPassword()?.length ?? 0) >= 12;

export { decryptBackup, encryptBackup, type BackupPayload } from "./format";

/** All application tables (migrations bookkeeping lives in its own schema and is recreated by migrate). */
export async function dumpDatabase(): Promise<BackupPayload> {
  const names = (await db.execute<{ t: string }>(sql`select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)).rows.map((r) => r.t);
  const tables: Record<string, unknown[]> = {};
  // one consistent snapshot of all tables
  await db.transaction(
    async (tx) => {
      for (const t of names) {
        const r = await tx.execute<{ rows: unknown[] | null }>(sql`select json_agg(x) as rows from ${sql.identifier(t)} x`);
        tables[t] = r.rows[0]?.rows ?? [];
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return { version: 1, createdAt: new Date().toISOString(), tables };
}

async function sendDocument(chatId: string, file: Buffer, filename: string, caption: string) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  form.set("document", new Blob([new Uint8Array(file)], { type: "application/octet-stream" }), filename);
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  const json = (await res.json().catch(() => null)) as { ok: boolean; description?: string } | null;
  if (!json?.ok) throw new Error(json?.description ?? `sendDocument ${res.status}`);
}

/** Creates an encrypted backup and sends it to the admins' Telegram. Returns what happened, for the admin UI. */
export async function runBackup(reason: "schedule" | "manual", adminId: string | null = null) {
  if (!backupEnabled()) throw new Error("Резервные копии выключены: не задан BACKUP_PASSWORD (минимум 12 символов)");
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Бот Telegram не настроен");
  const recipients = await db.select({ id: users.id, telegramId: users.telegramId }).from(users).where(and(eq(users.role, "admin"), isNotNull(users.telegramId), eq(users.isBlocked, false)));
  if (!recipients.length) throw new Error("Ни у одного администратора не привязан Telegram — некому отправить копию");
  const payload = await dumpDatabase();
  const rows = Object.values(payload.tables).reduce((n, t) => n + t.length, 0);
  const file = encryptBackup(payload, backupPassword()!);
  if (file.length > 48 * 1024 * 1024) throw new Error("Копия больше 48 МБ — Telegram её не примет, нужно хранилище S3");
  const stamp = payload.createdAt.slice(0, 16).replace("T", "_").replace(":", "-");
  const caption = `🗄 Резервная копия базы «Рядом»\n${new Date(payload.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Saratov" })} · ${rows.toLocaleString("ru-RU")} записей\n\nЗашифрована паролем BACKUP_PASSWORD. Сохраните файл — он нужен, только если база сломается.`;
  let sent = 0;
  for (const r of recipients) {
    try {
      await sendDocument(r.telegramId!, file, `ryadom-backup-${stamp}.rydb`, caption);
      sent++;
    } catch (e) {
      log.warn("backup: telegram send failed", { userId: r.id, e: String(e) });
    }
  }
  const result = { reason, rows, bytes: file.length, sent, recipients: recipients.length };
  await db.insert(adminActions).values({ adminId, action: "backup.run", targetType: "system", targetId: "backup", data: result });
  if (!sent) throw new Error("Копия создана, но в Telegram не отправилась — проверьте, что администратор нажал /start в боте");
  return result;
}

export async function lastBackup() {
  const [r] = await db.execute<{ created_at: string; data: { sent?: number } }>(sql`select created_at, data from admin_actions where action = 'backup.run' order by created_at desc limit 1`).then((x) => x.rows);
  if (!r) return null;
  const at = new Date(r.created_at);
  const sent = r.data?.sent ?? 0;
  // the nightly run missed (or failed to reach Telegram) for more than a day and a half
  return { at, sent, stale: sent === 0 || Date.now() - at.getTime() > 36 * 3600_000 };
}

/** Daily at ~03:30 Saratov time (UTC+4), started from instrumentation.ts in the Node.js server. */
export function scheduleDailyBackup() {
  if (!backupEnabled()) {
    log.info("backup: BACKUP_PASSWORD not set — daily backups are off");
    return;
  }
  const g = globalThis as unknown as { __backupTimer?: NodeJS.Timeout };
  if (g.__backupTimer) return;
  const next = () => {
    const now = new Date();
    const t = new Date(now);
    t.setUTCHours(23, 30, 0, 0); // 03:30 in Saratov
    if (t <= now) t.setUTCDate(t.getUTCDate() + 1);
    return t.getTime() - now.getTime();
  };
  const tick = async () => {
    try {
      const last = await lastBackup();
      // several restarts a day must not produce several backups
      if (!last || Date.now() - last.at.getTime() > 20 * 3600_000) await runBackup("schedule");
    } catch (e) {
      log.error("backup: scheduled run failed", { e: String(e) });
    } finally {
      g.__backupTimer = setTimeout(tick, next());
    }
  };
  // after a deploy or restart: catch up if the last copy is older than a day
  g.__backupTimer = setTimeout(tick, 5 * 60_000);
  log.info("backup: daily backups scheduled");
}
