import { api, body } from "@/server/http/handler";
import { registerSchema } from "@/lib/validation";
import { registerWithEmail } from "@/server/auth/service";
import { signIn } from "@/server/auth/respond";

export const POST = api(
  async (req) => {
    const input = await body(req, registerSchema);
    const user = await registerWithEmail(input);
    const { token } = await signIn(user.id, "email");
    return { ok: true, token };
  },
  { rate: { limit: 5, windowMs: 60 * 60_000, key: "register" } },
);
