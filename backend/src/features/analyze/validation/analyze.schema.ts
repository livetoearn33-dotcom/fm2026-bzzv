import { z } from "@hono/zod-openapi";

/**
 * /analyze 的 request／response schema。
 * Request 是「截圖模式」與「文字模式」二擇一的 union：
 * - 截圖模式：App 三顆語氣按鈕（同理／簡潔／肯定）＋截圖 base64，不走 golden path。
 * - 文字模式：既有對話陣列，golden path／demo 劇本靠它比對，維持原行為。
 */

export const ConversationMessageSchema = z.object({
  speaker: z.enum(["them", "me"]),
  text: z.string(),
  ts: z.string(),
});

/** App 已實作的三顆語氣按鈕，見 EQCopilot ComposeApiClient.kt */
export const AnalyzeToneSchema = z.enum(["empathy", "concise", "affirmative"]);

/**
 * 截圖模式：`screenshot` 接受裸 base64（App 送的形式，另帶 screenshotMimeType）
 * 或完整 data URL（`data:image/png;base64,...`，網頁前端常用形式），正規化見
 * services/screenshot.ts。大小上限由 api/routes.ts 的 bodyLimit middleware 擋（回 413），
 * 這裡不重覆用 zod .max() 限制字串長度，避免同一種超限出現兩種不同狀態碼。
 */
export const ScreenshotAnalyzeRequestSchema = z.object({
  screenshot: z.string().min(1),
  screenshotMimeType: z.string().optional(),
  tone: AnalyzeToneSchema,
  contactId: z.string().optional(),
  draft: z.string().optional(),
}).openapi("ScreenshotAnalyzeRequest");

/** 文字模式：既有形狀，tone 選填——不帶時維持現行語氣-Zeno.md 行為（向後相容）。 */
export const TextAnalyzeRequestSchema = z.object({
  conversation: z.array(ConversationMessageSchema).min(1),
  contactId: z.string().optional(),
  tone: AnalyzeToneSchema.optional(),
}).openapi("TextAnalyzeRequest");

export const AnalyzeRequestSchema = z.union([
  ScreenshotAnalyzeRequestSchema,
  TextAnalyzeRequestSchema,
]).openapi("AnalyzeRequest");

export const AnalyzeSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const AnalyzeResponseSchema = z.object({
  risk: z.enum(["safe", "pressure", "sensitive"]),
  riskReason: z.string(),
  safeCard: z.string(),
  reply: z.string(),
  naiveReply: z.string(),
  sources: z.array(AnalyzeSourceSchema),
  latencyMs: z.number(),
}).openapi("AnalyzeResponse");

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type AnalyzeTone = z.infer<typeof AnalyzeToneSchema>;
export type ScreenshotAnalyzeRequest = z.infer<typeof ScreenshotAnalyzeRequestSchema>;
export type TextAnalyzeRequest = z.infer<typeof TextAnalyzeRequestSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeSource = z.infer<typeof AnalyzeSourceSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/** 用 `screenshot` 欄位是否存在分流兩種模式——兩個 schema 的必填欄位互斥，不會誤判。 */
export function isScreenshotAnalyzeRequest(input: AnalyzeRequest): input is ScreenshotAnalyzeRequest {
  return "screenshot" in input;
}
