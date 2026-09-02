import { z } from "@hono/zod-openapi";

/**
 * generateObject 要求 LLM 產生的結構——對齊 prompts/引擎-analyze.md 的「輸出格式」。
 * 注意跟對外的 AnalyzeResponseSchema 不同：
 * - 沒有 safeCard（後端分流規則產生，不是 LLM 輸出）
 * - sources 只是 fact id 字串陣列，label 由後端拿 facts.json 補齊
 */
export const AnalyzeLlmOutputSchema = z.object({
  risk: z.enum(["safe", "pressure", "sensitive"]),
  riskReason: z.string(),
  reply: z.string(),
  naiveReply: z.string(),
  sources: z.array(z.string()),
});

export type AnalyzeLlmOutput = z.infer<typeof AnalyzeLlmOutputSchema>;
