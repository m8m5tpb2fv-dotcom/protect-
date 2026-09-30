import { cookies } from "next/headers";
import { z } from "zod";
import { api } from "@/server/http/handler";
import { signIn } from "@/server/auth/respond";
import { claimTelegramLogin, LOGIN_NONCE_COOKIE } from "@/server/auth/telegram-login";

/** Polled by the login page. Issues the session once the user confirmed in Telegram. */
export const POST = api<{ id: string }>(
  async (_req, { id }) => {
    const jar = await cookies();
    const r = await claimTelegramLogin(z.string().uuid().parse(id), jar.get(LOGIN_NONCE_COOKIE)?.value);
    if (r.status !== "ok") return { status: r.status };
    jar.delete({ name: LOGIN_NONCE_COOKIE, path: "/api/auth/telegram-login" });
    const { token } = await signIn(r.userId, "telegram");
    return { status: "ok", token };
  },
  { rate: { limit: 120, windowMs: 10 * 60_000, key: "tg-login-poll" } },
);
