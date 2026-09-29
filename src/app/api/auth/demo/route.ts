import { sql } from "drizzle-orm";
import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { env } from "@/server/env";
import { forbidden, notFound } from "@/server/http/errors";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { signIn } from "@/server/auth/respond";

const DEMO = { client: "client@demo.ryadom.local", provider: "provider@demo.ryadom.local" } as const;

/** One-click demo accounts. Disabled unless DEMO_MODE=true. Never logs into admin. */
export const POST = api(async (req) => {
  if (!env.DEMO_MODE) throw forbidden("Демо-режим выключен");
  const { as } = await body(req, z.object({ as: z.enum(["client", "provider"]) }));
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${DEMO[as]}`);
  if (!u) throw notFound("Демо-данные не загружены: npm run db:seed -- --demo");
  const { token } = await signIn(u.id, "demo");
  return { ok: true, token };
});
