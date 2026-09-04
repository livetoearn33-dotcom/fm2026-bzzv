import { z } from "@hono/zod-openapi";

/**
 * knowledge-bases（一次上傳 1..N 個 PDF → 抽取草稿 → 整庫確認寫入）的對外型別，
 * 形狀對齊 frontend_backend_contract.json 的 knowledgeBase 段。
 * DB 欄位定義見 src/db/schema.ts；儲存層轉換見 knowledge-base-store.ts。
 */

/** 單一 PDF 的處理狀態（DB 內部）。 */
export const DocumentStatusSchema = z.enum(["parsing", "extracted", "committed", "failed"]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/** 知識庫整體狀態（contract 的 extracting | draft | committed | failed）。 */
export const KnowledgeBaseStatusSchema = z.enum(["extracting", "draft", "committed", "failed"]);
export type KnowledgeBaseStatus = z.infer<typeof KnowledgeBaseStatusSchema>;

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
 * knowledge_documents.extracted_draft 這個 jsonb 欄位的形狀（單一 PDF 的抽取結果）：
 * 抽到東西（items 可能是空陣列）或 LLM 判定整份文件沒有可抽的事實。
 * 知識庫層的 draft 由所有文件的 extracted_draft 合併而成（見 knowledge-base-store.ts）。
 */
export const ExtractedDraftSchema = z.discriminatedUnion("extracted", [
  z.object({ extracted: z.literal(true), items: z.array(ExtractedFactItemSchema) }),
  z.object({ extracted: z.literal(false), reason: z.string() }),
]);
export type ExtractedDraft = z.infer<typeof ExtractedDraftSchema>;

/** 知識庫底下單一 PDF 的對外形狀。status/errorReason 是 contract 的超集——「跳過壞檔繼續」時 app 靠它顯示哪些檔失敗。 */
export const KnowledgeBaseFileSchema = z.object({
  id: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: z.number().nullable(),
  pageCount: z.number().nullable(),
  status: DocumentStatusSchema,
  errorReason: z.string().nullable(),
});
export type KnowledgeBaseFile = z.infer<typeof KnowledgeBaseFileSchema>;

/** GET /v1/knowledge-bases 列表單筆——不含 draft 全文，避免 payload 過大。 */
export const KnowledgeBaseSummarySchema = z.object({
  id: z.string(),
  /** 產品畫面的「專案名稱」；contract 未要求、選填 */
  name: z.string().nullable(),
  /** 內部知識庫：底下 facts 全部 usage: "internal"（AI 可參考、絕不透露給對方） */
  internal: z.boolean(),
  status: KnowledgeBaseStatusSchema,
  fileCount: z.number(),
  files: z.array(KnowledgeBaseFileSchema),
  createdAt: z.string(),
  errorReason: z.string().nullable(),
});
export type KnowledgeBaseSummary = z.infer<typeof KnowledgeBaseSummarySchema>;

/** GET /v1/knowledge-bases/{id} 用——多帶合併後的抽取草稿。 */
export const KnowledgeBaseDetailSchema = KnowledgeBaseSummarySchema.extend({
  draft: ExtractedDraftSchema.nullable(),
});
export type KnowledgeBaseDetail = z.infer<typeof KnowledgeBaseDetailSchema>;
