import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Drizzle schema（真源）。改這裡之後跑 `pnpm db:generate` 產生對應的 migration SQL
 * 到 backend/drizzle/，兩者都要進版控——不要手改 backend/drizzle/ 底下的 SQL 檔。
 *
 * 對外 API 契約（Fact.updatedAt 是 YYYY-MM-DD 字串）由
 * src/shared/knowledge/store.ts 的 repository 層轉換，這裡的 timestamptz 是儲存層內部格式。
 */

export const volatilityEnum = pgEnum("volatility", ["high", "low"]);
export const factUsageEnum = pgEnum("fact_usage", ["internal"]);
export const documentStatusEnum = pgEnum("document_status", ["parsing", "extracted", "committed", "failed"]);
export const knowledgeBaseStatusEnum = pgEnum("knowledge_base_status", ["extracting", "draft", "committed", "failed"]);

/**
 * 知識庫（frontend_backend_contract 的 knowledge-bases 資源）：一次上傳 1..N 個 PDF
 * 組成一個知識庫，抽取草稿確認後整庫 commit。name 是產品畫面的「專案名稱」，
 * contract 未要求、選填。status 對應 contract 的 extracting|draft|committed|failed。
 */
export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  /**
   * 內部知識庫：commit 出來的 facts 一律強制 usage: "internal"（AI 可參考、
   * 絕不寫進回覆／sources），commit 時不可逐條反轉；建立時決定、不可事後修改。
   */
  internal: boolean("internal").notNull().default(false),
  status: knowledgeBaseStatusEnum("status").notNull(),
  errorReason: text("error_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 知識庫底下的單一 PDF。刪知識庫連動刪文件（CASCADE）——contract 的刪除語意是
 * 「刪除整個知識庫及其關聯 documents」。knowledge_base_id 在 DB 層保持 nullable
 * （歷史孤兒列），新寫入的文件一律由程式碼掛上知識庫。
 */
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  pageCount: integer("page_count"),
  status: documentStatusEnum("status").notNull(),
  errorReason: text("error_reason"),
  extractedDraft: jsonb("extracted_draft"),
  knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const facts = pgTable("facts", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default([]),
  volatility: volatilityEnum("volatility").notNull(),
  usage: factUsageEnum("usage"),
  /** commit 時寫入。刪知識庫連動刪 facts（CASCADE）——frontend 預期「刪除後不可再被 RAG 引用」；手動建的 facts（null）不受影響。 */
  knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id, { onDelete: "cascade" }),
  sourceDocumentId: uuid("source_document_id").references(() => knowledgeDocuments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  tone: text("tone").notNull(),
  notes: text("notes").notNull(),
  recentTopics: text("recent_topics").array().notNull().default([]),
  /** 對象檔案不是 PDF 抽出來的知識——刪知識庫只脫鉤（SET NULL），不連動刪除。 */
  knowledgeBaseId: uuid("knowledge_base_id").references(() => knowledgeBases.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
