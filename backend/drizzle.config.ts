import { defineConfig } from "drizzle-kit";

// eslint-disable-next-line node/no-process-env -- drizzle-kit CLI 設定檔，不經過 src/env.ts 的 zod 驗證
const databaseUrl = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
