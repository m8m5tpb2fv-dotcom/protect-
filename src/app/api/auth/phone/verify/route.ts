import { api, body } from "@/server/http/handler";
import { phoneVerifySchema } from "@/lib/validation";
import { verifyPhoneCode } from "@/server/auth/service";
import { signIn } from "@/server/auth/respond";

export const POST = api(
  async (req) => {
    const input = await body(req, phoneVerifySchema);
    const { user, isNew } = await verifyPhoneCode(input);
    const { token } = await signIn(user.id, "phone");
    return { ok: true, token, isNew };
  },
  { rate: { limit: 20, windowMs: 10 * 60_000, key: "otp-verify" } },
);
