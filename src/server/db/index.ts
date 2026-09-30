import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { env } from "../env";

type DB = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __ryadomPool?: Pool; __ryadomDb?: DB };

function create(): DB {
  const pool = g.__ryadomPool ?? new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  g.__ryadomPool = pool;
  return drizzle(pool, { schema, casing: undefined });
}

export const db: DB = g.__ryadomDb ?? (g.__ryadomDb = create());
export { schema };
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;
