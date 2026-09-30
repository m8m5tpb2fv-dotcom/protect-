import { vi } from "vitest";

// Tests run against a dedicated database (created by tests/global or `npm run test:db`).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://ryadom:ryadom@localhost:5432/ryadom_test";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
process.env.TELEGRAM_BOT_TOKEN = "123456:TEST-TOKEN";
process.env.DEMO_MODE = "true";
(process.env as Record<string, string>).NODE_ENV = "test";

// next/headers & next/server `after` are request-scoped; services only use them for cookies / deferred work.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return {
    ...mod,
    after: () => {
      throw new Error("outside request");
    },
  };
});
