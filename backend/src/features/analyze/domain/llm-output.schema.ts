import { z } from "@hono/zod-openapi";

/**
 * generateText（Output.object）要求 LLM 產生的結構——對齊 prompts/引擎-analyze.md v0.2 的「輸出格式」。
 * 讀不到畫面上的對話時 LLM 只回 { error: "no_conversation" }，所以整體是個 union。
 * 注意跟對外的 AnalyzeResponseSchema 不同：sources 只是 fact id 字串陣列，
 * label 由後端拿 facts.json 補齊；也沒有 safeCard（機制已砍）。
 */

export const AnalyzeLlmErrorSchema = z.object({
  error: z.literal("no_conversation"),
});

export const AnalyzeLlmSuccessSchema = z.object({
  conversationText: z.string(),
  risk: z.enum(["safe", "pressure", "sensitive"]),
  riskReason: z.string(),
  reply: z.string(),
  naiveReply: z.string(),
  /** 只有〈本次任務〉指定了角色時 LLM 才會填這個欄位 */
  plainReply: z.string().optional(),
  sources: z.array(z.string()),
});

export const AnalyzeLlmOutputSchema = z.union([AnalyzeLlmErrorSchema, AnalyzeLlmSuccessSchema]);

export type AnalyzeLlmError = z.infer<typeof AnalyzeLlmErrorSchema>;
export type AnalyzeLlmSuccess = z.infer<typeof AnalyzeLlmSuccessSchema>;
export type AnalyzeLlmOutput = z.infer<typeof AnalyzeLlmOutputSchema>;

export function isAnalyzeLlmError(output: AnalyzeLlmOutput): output is AnalyzeLlmError {
  return "error" in output;
}
