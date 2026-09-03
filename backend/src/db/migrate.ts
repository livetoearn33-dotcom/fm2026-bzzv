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
 *
 * client 的釋放（release）與 unlock 分開處理、各自包 try/finally：
 * - 拿鎖那一步（`pg_advisory_lock`）本身失敗（例如呼叫端設了 lock_timeout 逾時、
 *   或連線在等鎖時斷掉）要直接 release client，不能走到下面的 try/finally——那個
 *   finally 假設鎖已經拿到，此時再送一次 unlock 沒有意義還可能再噴一次錯。
 * - 拿到鎖之後，unlock 失敗（例如連線在 `fn()` 執行期間斷掉）絕對不能讓 client
 *   洩漏，也不能蓋掉 `fn()` 真正的錯誤——所以 unlock 包自己的 try/catch 只記 log，
 *   release 永遠在最外層 finally 執行。
 */
export async function withMigrationLock<T>(
  client: AdvisoryLockClient,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    await client.query(`select pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`);
  }
  catch (error) {
    client.release();
    throw error;
  }

  try {
    return await fn();
  }
  finally {
    try {
      await client.query(`select pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`);
    }
    catch (unlockError) {
      // 不重拋：這裡如果拋出會取代 fn() 真正的錯誤（try 區塊的 return/throw 被
      // finally 內的例外蓋掉是 JS 語言規則），操作者只會看到 unlock 失敗，看不到
      // migration 本身為什麼失敗。連線既然已經斷了，unlock 失敗本來就在預期內
      // ——session 斷線 Postgres 會自動釋放 advisory lock，不需要靠這裡補救。
      console.error("⚠️ pg_advisory_unlock 失敗（連線可能已斷開，鎖會隨 session 結束自動釋放）：", unlockError);
    }
    finally {
      client.release();
    }
  }
}

/**
 * migration 卡住時最壞的情況：滾動部署裡有實例卡在 `pg_advisory_lock`（例如前一個
 * 實例的 lock session 洩漏、或資料庫本身沒回應），新實例會在 `serve()` 綁定 port 之前
 * 無限期等待——沒有 log、健康檢查失敗、部署卡死且完全無法判斷是不是 migration 的問題。
 * 用 `SET lock_timeout` 幫這個 session 的 `pg_advisory_lock` 設逾時上限：超過就讓
 * Postgres 直接把該 statement 取消並丟錯（大聲失敗），而不是無界等待。
 */
export const MIGRATION_LOCK_TIMEOUT_MS = 30_000;

export async function runMigrations(): Promise<void> {
  const db = createDb();
  const pool = getPool();
  const lockClient = await pool.connect();

  try {
    await lockClient.query(`SET lock_timeout = ${MIGRATION_LOCK_TIMEOUT_MS}`);
  }
  catch (error) {
    lockClient.release();
    throw error;
  }

  try {
    await withMigrationLock(lockClient, () => migrate(db, { migrationsFolder }));
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `migration 失敗或取得 advisory lock 逾時（${MIGRATION_LOCK_TIMEOUT_MS}ms）：${message}`
      + "——可能有其他實例卡住或該實例的鎖 session 洩漏，請檢查是否有卡死的部署或殘留連線",
      { cause: error },
    );
  }
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
