import { describe, expect, it, vi } from "vitest";

import type { AdvisoryLockClient } from "./migrate";

import { getPool } from "./client";
import { MIGRATION_ADVISORY_LOCK_KEY, MIGRATION_LOCK_TIMEOUT_MS, runMigrations, withMigrationLock } from "./migrate";

// runMigrations 會實際呼叫 drizzle 的 migrate() 與 ./client 的 createDb/getPool——
// 這裡把兩者都 mock 掉，只驗證 runMigrations 自己的邏輯（SET lock_timeout 的接線、
// 失敗時是否正確 release client），不依賴真的 Postgres。vi.mock 本身會被 vitest
// hoist 到檔案最頂端，寫在 import 之後純粹是為了通過 import/first 這條 lint 規則。
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: vi.fn(async () => undefined),
}));
vi.mock("./client", () => ({
  createDb: vi.fn(() => ({})),
  getPool: vi.fn(),
  closeDb: vi.fn(async () => undefined),
}));

/**
 * 這裡不連真的 Postgres（pglite 是單一 in-process 實例，不能模擬「兩個實例搶同一把
 * session-level advisory lock」的情境）。改用一個會真的阻塞的假鎖，模擬 Postgres
 * pg_advisory_lock 的語意：同一個 key 只有一個 client 能拿到，其餘的 query() 會卡住
 * 直到前一個 client unlock。用它驗證 withMigrationLock 確實序列化了兩個「實例」的
 * migrate 流程——這是本次要修的併發缺陷的核心語意。
 *
 * 真環境的重現驗證（無法在此沙箱起 docker，記錄步驟供人工驗證）：
 * 1. 本機起一個 Postgres（`docker run -p 5432:5432 -e POSTGRES_PASSWORD=x postgres:16`）。
 * 2. 設好 backend/.env 的 DATABASE_URL 指向它。
 * 3. 同時開兩個終端機都跑 `pnpm db:migrate`。
 * 4. 預期：其中一個先印出 "✅ migrations applied"；另一個會先卡在
 *    pg_advisory_lock，等前者釋放鎖之後才繼續（跑到「沒有新 migration 要套用」）並
 *    正常結束，兩者都不會報 DDL 相關的錯誤（例如「relation already exists」）。
 */
function createFakeAdvisoryLockServer() {
  let heldBy: number | undefined;
  const waiters: Array<() => void> = [];

  function makeClient(clientId: number): AdvisoryLockClient & { released: boolean } {
    const client = {
      released: false,
      async query(sql: string) {
        if (sql.includes("pg_advisory_lock(")) {
          await new Promise<void>((resolve) => {
            const tryAcquire = () => {
              if (heldBy === undefined) {
                heldBy = clientId;
                resolve();
              }
              else {
                waiters.push(tryAcquire);
              }
            };
            tryAcquire();
          });
          return;
        }
        if (sql.includes("pg_advisory_unlock(")) {
          if (heldBy === clientId) {
            heldBy = undefined;
            const next = waiters.shift();
            next?.();
          }
          return;
        }
        throw new Error(`未預期的 SQL：${sql}`);
      },
      release() {
        client.released = true;
      },
    };
    return client;
  }

  return { makeClient };
}

describe("withMigrationLock", () => {
  it("兩個「實例」同時搶鎖時，第二個的 fn 一定在第一個的 fn 結束後才開始跑（序列化，不重疊）", async () => {
    const server = createFakeAdvisoryLockServer();
    const clientA = server.makeClient(1);
    const clientB = server.makeClient(2);

    const events: string[] = [];
    let concurrentRunners = 0;
    let maxConcurrentRunners = 0;

    async function runFakeMigration(label: string, delayMs: number) {
      concurrentRunners += 1;
      maxConcurrentRunners = Math.max(maxConcurrentRunners, concurrentRunners);
      events.push(`${label}:start`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      events.push(`${label}:end`);
      concurrentRunners -= 1;
    }

    // A 先發起、故意跑得比較久；B 幾乎同時發起，模擬多實例同時啟動搶鎖。
    const runA = withMigrationLock(clientA, () => runFakeMigration("A", 20));
    const runB = withMigrationLock(clientB, () => runFakeMigration("B", 5));

    await Promise.all([runA, runB]);

    // 核心斷言：任何時刻最多只有一個 fn 在跑——這就是要防的「多實例同時撞 DDL」。
    expect(maxConcurrentRunners).toBe(1);
    // A 先拿到鎖，所以 A 完整跑完（start/end）之後 B 才開始。
    expect(events).toEqual(["A:start", "A:end", "B:start", "B:end"]);
    expect(clientA.released).toBe(true);
    expect(clientB.released).toBe(true);
  });

  it("fn 失敗時仍會 unlock 並 release（不會把鎖卡死）", async () => {
    const server = createFakeAdvisoryLockServer();
    const client = server.makeClient(1);
    const unlockSpy = vi.spyOn(client, "query");

    await expect(
      withMigrationLock(client, async () => {
        throw new Error("migration 失敗");
      }),
    ).rejects.toThrow("migration 失敗");

    expect(client.released).toBe(true);
    const unlockCalls = unlockSpy.mock.calls.filter(([sql]) => String(sql).includes("pg_advisory_unlock"));
    expect(unlockCalls).toHaveLength(1);

    // 鎖真的被釋放了：下一個 client 用同一個 key 應該能立刻拿到，不會卡住。
    const nextClient = server.makeClient(2);
    await expect(nextClient.query(`select pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`)).resolves.toBeUndefined();
  });

  /**
   * 以下三個測試對應「unlock 連線洩漏＋掩蓋真錯誤」與「拿鎖本身失敗」的修復：
   * unlock 失敗不該蓋掉 fn() 的結果／錯誤，client 在任何路徑都一定要被 release。
   */

  it("拿鎖（pg_advisory_lock）本身失敗時：release client、拋出原始錯誤，且完全不呼叫 fn 或 unlock", async () => {
    let fnCalled = false;
    let released = false;
    const client: AdvisoryLockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_advisory_lock(")) {
          throw new Error("connection terminated unexpectedly");
        }
        throw new Error(`未預期的 SQL：${sql}`);
      }),
      release: () => { released = true; },
    };

    await expect(
      withMigrationLock(client, async () => {
        fnCalled = true;
        return "unreachable";
      }),
    ).rejects.toThrow("connection terminated unexpectedly");

    expect(fnCalled).toBe(false);
    expect(released).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(1); // 只嘗試了 lock，沒有多餘的 unlock 呼叫
  });

  it("fn 成功但 unlock 失敗時：仍會 release client，且回傳的是 fn 的結果（不拋出 unlock 的錯誤）", async () => {
    let released = false;
    const client: AdvisoryLockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_advisory_lock("))
          return undefined;
        if (sql.includes("pg_advisory_unlock(")) {
          throw new Error("連線在 migration 執行期間斷開");
        }
        throw new Error(`未預期的 SQL：${sql}`);
      }),
      release: () => { released = true; },
    };

    await expect(withMigrationLock(client, async () => "migration 完成")).resolves.toBe("migration 完成");
    expect(released).toBe(true);
  });

  it("fn 失敗且 unlock 也失敗時：拋出的是 fn 的原始錯誤（不被 unlock 的錯誤取代），client 仍會被 release", async () => {
    let released = false;
    const client: AdvisoryLockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_advisory_lock("))
          return undefined;
        if (sql.includes("pg_advisory_unlock(")) {
          throw new Error("連線在 migration 執行期間斷開");
        }
        throw new Error(`未預期的 SQL：${sql}`);
      }),
      release: () => { released = true; },
    };

    await expect(
      withMigrationLock(client, async () => {
        throw new Error("DDL 失敗：relation already exists");
      }),
    ).rejects.toThrow("DDL 失敗：relation already exists");
    expect(released).toBe(true);
  });
});

/**
 * runMigrations 本身接的是 `SET lock_timeout`——目的是滾動部署時若有實例卡在
 * pg_advisory_lock（見 db/migrate.ts 頂部註解），新實例不會無界等待、會在逾時後
 * 大聲失敗並印出清楚訊息，而不是讓 HTTP listener 永遠卡住不 bind port。
 *
 * `SET lock_timeout` 真的觸發逾時（Postgres 實際取消 statement）這件事本身無法在
 * 沒有真正 Postgres 的環境重現（pglite 是單一 in-process 實例，見上方註解），
 * 人工驗證步驟：
 * 1. 本機起一個 Postgres，開一個連線持有 `select pg_advisory_lock(726190426)`
 *    （跟 MIGRATION_ADVISORY_LOCK_KEY 同一個 key）且故意不釋放。
 * 2. 設定 backend/.env 指向它，跑 `pnpm db:migrate`。
 * 3. 預期：約 `MIGRATION_LOCK_TIMEOUT_MS` 毫秒後印出「migration 失敗或取得 advisory
 *    lock 逾時」並以非 0 結束，而不是無限期卡住。
 */
describe("runMigrations", () => {
  it("設定 lock_timeout（SET lock_timeout）失敗，例如連線斷開時：release lock client、拋出清楚訊息，且不會呼叫 migrate", async () => {
    const released = vi.fn();
    const lockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SET lock_timeout")) {
          throw new Error("connection terminated unexpectedly");
        }
        throw new Error(`未預期的 SQL：${sql}`);
      }),
      release: released,
    };
    vi.mocked(getPool).mockReturnValue({
      connect: vi.fn(async () => lockClient),
    } as any);

    await expect(runMigrations()).rejects.toThrow("connection terminated unexpectedly");
    expect(released).toHaveBeenCalledTimes(1);
    // 從沒走到 pg_advisory_lock 那一步——SET lock_timeout 失敗就直接中止。
    expect(lockClient.query).toHaveBeenCalledTimes(1);
  });

  it("拿鎖逾時（pg_advisory_lock 被 Postgres 取消）時：錯誤訊息附上 MIGRATION_LOCK_TIMEOUT_MS，方便操作者判斷是不是卡鎖", async () => {
    const lockClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("SET lock_timeout"))
          return undefined;
        if (sql.includes("pg_advisory_lock(")) {
          throw new Error("canceling statement due to lock timeout");
        }
        throw new Error(`未預期的 SQL：${sql}`);
      }),
      release: vi.fn(),
    };
    vi.mocked(getPool).mockReturnValue({
      connect: vi.fn(async () => lockClient),
    } as any);

    await expect(runMigrations()).rejects.toThrow(String(MIGRATION_LOCK_TIMEOUT_MS));
    expect(lockClient.release).toHaveBeenCalledTimes(1);
  });
});
