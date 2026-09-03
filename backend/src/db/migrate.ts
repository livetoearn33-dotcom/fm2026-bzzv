import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closeDb, createDb, getPool } from "./client";

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

/**
 * 固定的 advisory lock key：多實例同時啟動（水平擴展、或本機與 CI 同時跑
 * `pnpm db:migrate`）時，序列化整個 migrate 流程，避免在同一份 DDL 上撞車。
 * 數字本身沒有特殊意義，只要所有實例共用同一個常數即可（换掉會讓新舊實例互不擋）。
 */
export const MIGRATION_ADVISORY_LOCK_KEY = 726_190_426;

/** 只用得到 pg 的 advisory lock 兩支函式跟 release——方便測試造假 client，不用連真的 Postgres。 */
export interface AdvisoryLockClient {
  query: (sql: string) => Promise<unknown>;
  release: () => void;
}

/**
 * 用單一 client 持有 session-level advisory lock 包住 `fn`。
 * pg_advisory_lock 是 session-scoped：只要這個 client 沒斷線，其他 session 呼叫
 * pg_advisory_lock 用同一個 key 就會卡住，直到這裡呼叫 pg_advisory_unlock 或 client 斷線。
 * `fn` 本身用哪個連線跑 migration 不重要——鎖只在乎「同時只有一個 session 持有」。
 */
export async function withMigrationLock<T>(
  client: AdvisoryLockClient,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query(`select pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`);
  try {
    return await fn();
  }
  finally {
    await client.query(`select pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`);
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  const db = createDb();
  const pool = getPool();
  const lockClient = await pool.connect();
  await withMigrationLock(lockClient, () => migrate(db, { migrationsFolder }));
}

const isMainModule = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  runMigrations()
    .then(async () => {
      // eslint-disable-next-line no-console
      console.log("✅ migrations applied");
      await closeDb();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("❌ migration failed", error);
      await closeDb();
      process.exit(1);
    });
}
