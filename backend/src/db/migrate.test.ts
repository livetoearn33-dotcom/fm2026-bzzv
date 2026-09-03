import { describe, expect, it, vi } from "vitest";

import type { AdvisoryLockClient } from "./migrate";

import { MIGRATION_ADVISORY_LOCK_KEY, withMigrationLock } from "./migrate";

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
});
