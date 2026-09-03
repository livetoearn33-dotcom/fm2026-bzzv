import { serve } from "@hono/node-server";

import app from "@/app";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seedIfEmpty } from "@/db/seed";
import env from "@/env";

const port = env.PORT;

try {
  await runMigrations();
}
catch (error) {
  // 大聲失敗：不要讓 HTTP listener 卡在無診斷訊息的狀態（見 db/migrate.ts 的
  // MIGRATION_LOCK_TIMEOUT_MS 註解）。印清楚訊息後直接讓 process 以非 0 結束，
  // 部署平台的健康檢查會失敗、但至少 log 裡看得出來是 migration 出的問題。
  console.error("❌ DB migrations failed:", error);
  process.exit(1);
}
// eslint-disable-next-line no-console
console.log("✅ DB migrations applied");

// 只有偵測到 facts／contacts 都是空表（全新部署）才自動 seed；只要任一表已有資料
// 就跳過，避免把使用者刪掉的 demo 資料又塞回去（見 db/seed.ts 的 seedIfEmpty）。
const seedResult = await seedIfEmpty(createDb());
if (seedResult.seeded) {
  // eslint-disable-next-line no-console
  console.log(`✅ 偵測到空的知識庫，已自動 seed：facts ${seedResult.factsInserted} 筆、contacts ${seedResult.contactsInserted} 筆`);
}

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
