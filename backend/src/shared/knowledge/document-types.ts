import { z } from "@hono/zod-openapi";

/**
 * knowledge_documents（PDF 上傳 → 抽取草稿 → 確認寫入）的對外型別。
 * DB 欄位定義見 src/db/schema.ts；儲存層轉換見 document-store.ts。
 */

export const DocumentStatusSchema = z.enum(["parsing", "extracted", "committed", "failed"]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/**
 * PDF 抽取草稿單筆條目。`suggestedId` 由後端生成（見 services/slug.ts），
 * 使用者確認前可在前端編輯成最終 id；欄位其餘部分與 Fact 相容（usage 省略＝可引用）。
 */
export const ExtractedFactItemSchema = z.object({
  suggestedId: z.string(),
  label: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  volatility: z.enum(["high", "low"]),
  usage: z.enum(["internal"]).optional(),
});
export type ExtractedFactItem = z.infer<typeof ExtractedFactItemSchema>;

/**
 * knowledge_documents.extracted_draft 這個 jsonb 欄位的形狀：
 * 抽到東西（items 可能是空陣列）或 LLM 判定整份文件沒有可抽的事實。
 */
export const ExtractedDraftSchema = z.discriminatedUnion("extracted", [
  z.object({ extracted: z.literal(true), items: z.array(ExtractedFactItemSchema) }),
  z.object({ extracted: z.literal(false), reason: z.string() }),
]);
export type ExtractedDraft = z.infer<typeof ExtractedDraftSchema>;

/** GET /v1/knowledge/documents 列表用——不含 extracted_draft，避免 payload 過大。 */
export const KnowledgeDocumentSummarySchema = z.object({
  id: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().nullable(),
  pageCount: z.number().nullable(),
  status: DocumentStatusSchema,
  errorReason: z.string().nullable(),
  /** 上傳時指定的所屬專案 id（見 /v1/projects）；null＝未歸屬任何專案 */
  projectId: z.string().nullable(),
  createdAt: z.string(),
});
export type KnowledgeDocumentSummary = z.infer<typeof KnowledgeDocumentSummarySchema>;

/** GET /v1/knowledge/documents/{id} 用——多帶草稿內容。 */
export const KnowledgeDocumentDetailSchema = KnowledgeDocumentSummarySchema.extend({
  draft: ExtractedDraftSchema.nullable(),
});
export type KnowledgeDocumentDetail = z.infer<typeof KnowledgeDocumentDetailSchema>;
