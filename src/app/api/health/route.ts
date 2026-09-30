import { sql } from "drizzle-orm";
import { db } from "@/server/db";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
