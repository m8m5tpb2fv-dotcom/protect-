import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  allows_write_to_pm?: boolean;
};

export type VerifiedInitData = { user: TelegramWebAppUser; authDate: Date; startParam?: string; queryId?: string };

/**
 * Validates Telegram Mini App `initData` as described in
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *   secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   hash       = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
 * Returns null when the signature is invalid or data is older than maxAgeSec.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec = 86400, now = Date.now()): VerifiedInitData | null {
  if (!initData || !botToken || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (maxAgeSec > 0 && now / 1000 - authDate > maxAgeSec) return null;

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(params.get("user") ?? "");
  } catch {
    return null;
  }
  if (!user || typeof user.id !== "number") return null;
  return { user, authDate: new Date(authDate * 1000), startParam: params.get("start_param") ?? undefined, queryId: params.get("query_id") ?? undefined };
}

/** Test helper / local simulator: produces a correctly signed initData string. */
export function signInitData(fields: Record<string, string>, botToken: string) {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}
