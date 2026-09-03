import { z } from "@hono/zod-openapi";

/**
 * /analyze 的 request／response schema。
 * 形狀嚴格對齊 docs/spec.md 決策表與 prompts/README-組裝說明.md「v0.2 重大變更」段：
 * 輸入改截圖、砍 safeCard、golden path 改二段式、persona 併入本端點。
 */

export const AnalyzePersonaIdSchema = z.enum(["zhuge", "ceo", "charmer"]);

export const AnalyzeRequestSchema = z.object({
  /** 手機截圖，base64 data URL（例：data:image/png;base64,...）。VLM 讀圖取代原本的文字對話陣列 */
  screenshot: z.string().regex(
    /^data:image\/[\w.+-]+;base64,[A-Z0-9+/=]+$/i,
    "screenshot 必須是 image 的 base64 data URL",
  ),
  /** 使用者已經自己打在輸入框的字（防自爆改寫路徑用）；不帶時任務是「產生回覆」 */
  draft: z.string().optional(),
  contactId: z.string().optional(),
  /** 指定角色時直接產角色版回覆，見「角色版回覆」契約 */
  persona: AnalyzePersonaIdSchema.optional(),
}).openapi("AnalyzeRequest");

export const AnalyzeSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const AnalyzeResponseSchema = z.object({
  /** LLM 從截圖讀到的對話，後端拿它比對 golden path，前端也可用來顯示「讀到了什麼」 */
  conversationText: z.string(),
  risk: z.enum(["safe", "pressure", "sensitive"]),
  riskReason: z.string(),
  reply: z.string(),
  naiveReply: z.string(),
  /** 指定角色時才有：改寫前的正常版回覆 */
  plainReply: z.string().optional(),
  sources: z.array(AnalyzeSourceSchema),
  latencyMs: z.number(),
}).openapi("AnalyzeResponse");

export type AnalyzePersonaId = z.infer<typeof AnalyzePersonaIdSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeSource = z.infer<typeof AnalyzeSourceSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
