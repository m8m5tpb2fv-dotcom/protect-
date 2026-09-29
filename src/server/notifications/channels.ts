import "server-only";
import { env } from "../env";
import { log } from "../log";

/** SMS gateway abstraction. `console` prints codes to the log (dev / demo). */
export async function sendSms(phone: string, text: string): Promise<"sent" | "logged"> {
  if (env.SMS_PROVIDER === "smsru" && env.SMSRU_API_KEY) {
    const url = new URL("https://sms.ru/sms/send");
    url.searchParams.set("api_id", env.SMSRU_API_KEY);
    url.searchParams.set("to", phone.replace("+", ""));
    url.searchParams.set("msg", text);
    url.searchParams.set("json", "1");
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("SMS gateway error");
    return "sent";
  }
  log.info("[sms:console]", { phone, text });
  return "logged";
}

/** Email abstraction. `console` logs the message; `resend` uses the Resend HTTP API. */
export async function sendEmail(to: string, subject: string, text: string): Promise<"sent" | "logged"> {
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("Email provider error");
    return "sent";
  }
  log.info("[email:console]", { to, subject });
  return "logged";
}
