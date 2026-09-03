import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import env from "@/env";

import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;

function ensurePool(): Pool {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL 未設定，無法連線 Postgres（見 .env.example）");
  }
  pool ??= new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

/**
 * 建立 production 用的 Postgres 連線（node-postgres driver）。
 * 測試請改用 src/db/test-client.ts 的 pglite 版本，不要連真的 Postgres。
 */
export function createDb(): Db {
  return drizzle(ensurePool(), { schema });
}

/**
 * 拿到底層的 pg Pool——migrate.ts 用來取一條專屬連線做 session-level advisory lock，
 * 跟 createDb() 共用同一個 pool 單例（見 runMigrations）。
 */
export function getPool(): Pool {
  return ensurePool();
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
