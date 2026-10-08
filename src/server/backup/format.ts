import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Backup file format (no server-only imports: used by scripts/restore-backup.ts too).
 * "RYDB1" | salt(16) | iv(12) | tag(16) | AES-256-GCM(gzip(JSON)), key = scrypt(BACKUP_PASSWORD, salt).
 */
const MAGIC = Buffer.from("RYDB1");

export type BackupPayload = { version: 1; createdAt: string; tables: Record<string, unknown[]> };

export function encryptBackup(payload: BackupPayload, password: string) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(password, salt, 32);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(gzipSync(JSON.stringify(payload))), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

export function decryptBackup(file: Buffer, password: string): BackupPayload {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Это не файл резервной копии «Рядом»");
  let o = MAGIC.length;
  const salt = file.subarray(o, (o += 16));
  const iv = file.subarray(o, (o += 12));
  const tag = file.subarray(o, (o += 16));
  const d = createDecipheriv("aes-256-gcm", scryptSync(password, salt, 32), iv);
  d.setAuthTag(tag);
  try {
    return JSON.parse(gunzipSync(Buffer.concat([d.update(file.subarray(o)), d.final()])).toString("utf8"));
  } catch {
    throw new Error("Неверный пароль или файл повреждён");
  }
}

