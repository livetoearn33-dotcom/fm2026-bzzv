import { z } from "@hono/zod-openapi";

import { ExtractedFactItemSchema, FactSchema, KnowledgeDocumentDetailSchema, KnowledgeDocumentSummarySchema } from "@/shared/knowledge";

/**
 * POST /v1/knowledge/documents、/v1/knowledge/documents/{id}、
 * /v1/knowledge/documents/{id}/commit 的 request／response schema。
 */

export const UploadDocumentBodySchema = z.object({
  file: z.instanceof(File).openapi({ type: "string", format: "binary" }),
}).openapi("UploadDocumentBody");

/**
 * 成功回應是 { documentId, status, items[] } 這個 table 契約的超集：
 * LLM 判定整份文件抽不到事實時（extracted:false），items 是空陣列、
 * 另外多帶 extracted/reason 讓前端能照 mockExtract() 的「抽不到」流程原文顯示 reason。
 */
export const UploadDocumentResponseSchema = z.object({
  documentId: z.string(),
  status: z.literal("extracted"),
  items: z.array(ExtractedFactItemSchema),
  extracted: z.boolean(),
  reason: z.string().optional(),
}).openapi("UploadDocumentResponse");

export const DocumentListResponseSchema = z.array(KnowledgeDocumentSummarySchema).openapi("DocumentList");

export const DocumentDetailResponseSchema = KnowledgeDocumentDetailSchema.openapi("DocumentDetail");

export const DocumentIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "b6b6f0d0-7f3e-4a1b-9c2d-000000000000",
  }),
}).openapi("DocumentIdParams");

/** 使用者確認／編輯過的單筆草稿——internal 是前端可勾選的開關，映射成 Fact.usage。 */
export const DocumentCommitItemSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  volatility: z.enum(["high", "low"]),
  internal: z.boolean().default(false),
}).openapi("DocumentCommitItem");

export const DocumentCommitBodySchema = z.object({
  items: z.array(DocumentCommitItemSchema).min(1),
}).openapi("DocumentCommitBody");

export const DocumentCommitResponseSchema = z.array(FactSchema).openapi("DocumentCommitResponse");

export type UploadDocumentBody = z.infer<typeof UploadDocumentBodySchema>;
export type DocumentIdParams = z.infer<typeof DocumentIdParamsSchema>;
export type DocumentCommitItem = z.infer<typeof DocumentCommitItemSchema>;
export type DocumentCommitBody = z.infer<typeof DocumentCommitBodySchema>;
