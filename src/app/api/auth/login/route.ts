import { api, body, clientIp } from "@/server/http/handler";
import { loginSchema } from "@/lib/validation";
import { loginWithEmail } from "@/server/auth/service";
import { signIn } from "@/server/auth/respond";

export const POST = api(async (req) => {
  const input = await body(req, loginSchema);
  const user = await loginWithEmail(input, clientIp(req));
  const { token } = await signIn(user.id, "email");
  return { ok: true, token };
});
