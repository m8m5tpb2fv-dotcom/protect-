import { cookies } from "next/headers";
import { api } from "@/server/http/handler";
import { requestMeta, isSecureContext } from "@/server/auth/session";
import { LOGIN_NONCE_COOKIE, loginStartParam, startTelegramLogin } from "@/server/auth/telegram-login";
import { botUsername } from "@/server/telegram/config";
import { AppError } from "@/server/http/errors";

/** Starts «Войти через Telegram»: returns a one-time bot link and binds the request to this browser. */
export const POST = api(
  async () => {
    const bot = await botUsername();
    if (!bot) throw new AppError(503, "telegram_disabled", "Вход через Telegram пока не настроен");
    const r = await startTelegramLogin(await requestMeta());
    (await cookies()).set(LOGIN_NONCE_COOKIE, r.nonce, { httpOnly: true, secure: isSecureContext(), sameSite: "lax", path: "/api/auth/telegram-login", expires: r.expiresAt });
    return { id: r.id, url: `https://t.me/${bot}?start=${loginStartParam(r.token)}`, expiresAt: r.expiresAt.toISOString() };
  },
  { rate: { limit: 10, windowMs: 10 * 60_000, key: "tg-login-start" } },
);
