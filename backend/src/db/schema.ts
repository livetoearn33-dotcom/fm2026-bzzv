import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/**
 * 專案是知識庫的父層實體（對應 Android app-settings 的「每個知識庫以專案為單位」）：
 * facts／contacts／knowledge_documents 都可以用 project_id 掛在某個專案底下。
 * 刪除專案時底下資料保留但脫鉤（ON DELETE SET NULL），跟刪除文件的溯源語意一致。
 */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** PDF 上傳（下一批功能）會用到；本次只建結構，不接 endpoint。 */
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  pageCount: integer("page_count"),
  status: documentStatusEnum("status").notNull(),
  errorReason: text("error_reason"),
  extractedDraft: jsonb("extracted_draft"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const facts = pgTable("facts", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default([]),
  volatility: volatilityEnum("volatility").notNull(),
  usage: factUsageEnum("usage"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
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
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
