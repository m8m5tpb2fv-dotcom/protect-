import { api, body, clientIp } from "@/server/http/handler";
import { phoneRequestSchema } from "@/lib/validation";
import { requestPhoneCode } from "@/server/auth/service";

export const POST = api(async (req) => {
  const { phone } = await body(req, phoneRequestSchema);
  return requestPhoneCode(phone, clientIp(req));
});
