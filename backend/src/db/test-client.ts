import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * 測試專用：記憶體內的真 Postgres（pglite），套用與 production 相同的
 * migration SQL（backend/drizzle/），不用 docker、不用真的 DATABASE_URL。
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
