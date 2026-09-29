/** Minimal structured logger. Swap for pino / Sentry transport in production. */
type Level = "debug" | "info" | "warn" | "error";
const isProd = process.env.NODE_ENV === "production";

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  if (level === "debug" && isProd) return;
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const entry = { t: new Date().toISOString(), level, msg, ...data };
  const line = isProd ? JSON.stringify(entry) : `[${level}] ${msg}${data ? " " + JSON.stringify(data) : ""}`;
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const log = {
  debug: (m: string, d?: Record<string, unknown>) => write("debug", m, d),
  info: (m: string, d?: Record<string, unknown>) => write("info", m, d),
  warn: (m: string, d?: Record<string, unknown>) => write("warn", m, d),
  error: (m: string, d?: Record<string, unknown>) => write("error", m, d),
};
