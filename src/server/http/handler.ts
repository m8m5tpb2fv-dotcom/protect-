import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { log } from "../log";
import { AppError, badRequest, forbidden, tooMany } from "./errors";
import { rateLimit } from "./rate-limit";
import { env } from "../env";

type Ctx<P> = { params: Promise<P> };
type Options = {
  /** requests per window per client IP */
  rate?: { limit: number; windowMs: number; key?: string };
  /** skip CSRF check (webhooks authenticated by signature) */
  public?: boolean;
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/**
 * CSRF defence for cookie-authenticated mutations:
 *  1) Origin (or Referer) must match our host, and
 *  2) a custom header must be present — browsers cannot attach it cross-site without a CORS preflight, which we never allow.
 * Bearer-token requests are not vulnerable to CSRF, so they only need (2)-less validation.
 */
export function checkCsrf(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  if (req.headers.get("x-ryadom") !== "1") throw forbidden("CSRF: missing header");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return; // same-origin fetches from older browsers may omit it; custom header already proves same-origin
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw forbidden("CSRF: bad origin");
  }
  const allowed = new Set([req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "", safeHost(env.APP_URL)]);
  if (!allowed.has(host)) throw forbidden("CSRF: origin mismatch");
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (e instanceof ZodError) {
    const issues = e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return NextResponse.json({ error: { code: "validation", message: issues[0]?.message ?? "Проверьте данные", details: issues } }, { status: 400 });
  }
  log.error("unhandled api error", { error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e) });
  return NextResponse.json({ error: { code: "internal", message: "Что-то пошло не так. Мы уже разбираемся." } }, { status: 500 });
}

export function api<P = Record<string, string>>(fn: (req: NextRequest, params: P) => Promise<unknown>, opts: Options = {}) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!opts.public) checkCsrf(req);
      if (opts.rate) {
        const key = `${opts.rate.key ?? new URL(req.url).pathname}:${clientIp(req)}`;
        const r = rateLimit(key, opts.rate.limit, opts.rate.windowMs);
        if (!r.ok) throw tooMany();
      } else if (MUTATING.has(req.method)) {
        // sane default for every mutation
        const r = rateLimit(`mut:${clientIp(req)}`, 120, 60_000);
        if (!r.ok) throw tooMany();
      }
      const params = (await ctx?.params) ?? ({} as P);
      const result = await fn(req, params);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Ожидался JSON");
  }
  return schema.parse(json);
}

export function query<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}
