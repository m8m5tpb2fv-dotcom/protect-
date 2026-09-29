import { eq } from "drizzle-orm";
import { api, body } from "@/server/http/handler";
import { telegramAuthSchema } from "@/lib/validation";
import { loginWithTelegram } from "@/server/auth/service";
import { signIn } from "@/server/auth/respond";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/** Mini App auto-login. If a web session already exists without Telegram, the account is linked instead. */
export const POST = api(
  async (req) => {
    const { initData } = await body(req, telegramAuthSchema);
    const current = await getCurrentUser();
    const { user, isNew } = await loginWithTelegram(initData);
    if (current && current.id !== user.id && !current.telegramId && isNew) {
      // link the freshly created telegram identity to the logged-in account
      await db.update(users).set({ telegramId: null }).where(eq(users.id, user.id));
      await db.delete(users).where(eq(users.id, user.id));
      await db.update(users).set({ telegramId: user.telegramId, telegramUsername: user.telegramUsername, telegramChatAllowed: user.telegramChatAllowed }).where(eq(users.id, current.id));
      const { token } = await signIn(current.id, "telegram");
      return { ok: true, token, linked: true };
    }
    const { token } = await signIn(user.id, "telegram");
    return { ok: true, token, isNew };
  },
  { rate: { limit: 30, windowMs: 60_000, key: "tg-auth" } },
);
