import { z } from "@hono/zod-openapi";

import {
  ExtractedFactItemSchema,
  FactSchema,
  KnowledgeBaseDetailSchema,
  KnowledgeBaseFileSchema,
  KnowledgeBaseSummarySchema,
} from "@/shared/knowledge";

/**
 * /v1/knowledge-bases 的 request／response schema，
 * 形狀對齊 frontend_backend_contract.json（2026-09-04-v1）的 knowledgeBase 段。
 */

const FileFieldSchema = z.instanceof(File).openapi({ type: "string", format: "binary" });

/**
 * multipart 欄位名統一為 `files`（contract 的 frontendBackendAgreementNeeded 第一條）。
 * hono 的 form validator 會把同名多值收成陣列；只送一個檔時是單一 File——union 兩者
 * 並正規化成陣列。
 */
export const CreateKnowledgeBaseBodySchema = z.object({
  files: z.union([FileFieldSchema, z.array(FileFieldSchema).min(1)])
    .transform(value => (Array.isArray(value) ? value : [value]))
    .openapi({ type: "array", items: { type: "string", format: "binary" } }),
  /** 產品畫面的「專案名稱」；contract 未要求、選填 */
  name: z.string().min(1).optional().openapi({ example: "宏碩 Q4 報價案" }),
  /**
   * 內部知識庫：commit 出來的 facts 全部強制 usage: "internal"——AI 可參考、
   * 絕不寫進回覆／sources。multipart 的值是字串，收 "true"/"false"；省略＝false。
   * 建立時決定、不可事後修改。
   */
  internal: z.enum(["true", "false"]).optional().transform(value => value === "true").openapi({ type: "boolean", example: false }),
}).openapi("CreateKnowledgeBaseBody");

export const CreateKnowledgeBaseResponseSchema = z.object({
  knowledgeBaseId: z.string(),
  name: z.string().nullable(),
  internal: z.boolean(),
  status: z.literal("draft"),
  files: z.array(KnowledgeBaseFileSchema),
  extracted: z.boolean(),
  reason: z.string().nullable(),
  items: z.array(ExtractedFactItemSchema),
}).openapi("CreateKnowledgeBaseResponse");

export const KnowledgeBaseListResponseSchema = z.array(KnowledgeBaseSummarySchema).openapi("KnowledgeBaseList");

export const KnowledgeBaseDetailResponseSchema = KnowledgeBaseDetailSchema.openapi("KnowledgeBaseDetail");

export const KnowledgeBaseIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "b6b6f0d0-7f3e-4a1b-9c2d-000000000000",
  }),
}).openapi("KnowledgeBaseIdParams");

/** 使用者確認／編輯過的單筆草稿——internal 是前端可勾選的開關，映射成 Fact.usage。 */
export const KnowledgeBaseCommitItemSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  volatility: z.enum(["high", "low"]),
  internal: z.boolean().default(false),
}).openapi("KnowledgeBaseCommitItem");

export const KnowledgeBaseCommitBodySchema = z.object({
  items: z.array(KnowledgeBaseCommitItemSchema).min(1),
}).openapi("KnowledgeBaseCommitBody");

export const KnowledgeBaseCommitResponseSchema = z.object({
  knowledgeBaseId: z.string(),
  status: z.literal("committed"),
  facts: z.array(FactSchema),
}).openapi("KnowledgeBaseCommitResponse");

export type CreateKnowledgeBaseBody = z.infer<typeof CreateKnowledgeBaseBodySchema>;
export type KnowledgeBaseIdParams = z.infer<typeof KnowledgeBaseIdParamsSchema>;
export type KnowledgeBaseCommitItem = z.infer<typeof KnowledgeBaseCommitItemSchema>;
export type KnowledgeBaseCommitBody = z.infer<typeof KnowledgeBaseCommitBodySchema>;
