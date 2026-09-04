import { z } from "@hono/zod-openapi";

/**
 * generateText（Output.object）要求 LLM 產生的結構——對齊 prompts/引擎-extract-pdf.md 的「輸出格式」。
 * 用 discriminatedUnion 讓「抽不到」時不必產生 items（沿用 guard 既有慣例）。
 * 注意這裡沒有 suggestedId——id 由後端生成（見 services/slug.ts）。
 */
export const DocumentExtractLlmItemSchema = z.object({
  label: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  volatility: z.enum(["high", "low"]),
  usage: z.enum(["internal"]).optional(),
});

export const DocumentExtractLlmOutputSchema = z.discriminatedUnion("extracted", [
  z.object({
    extracted: z.literal(true),
    items: z.array(DocumentExtractLlmItemSchema),
  }),
  z.object({
    extracted: z.literal(false),
    reason: z.string(),
  }),
]);

export type DocumentExtractLlmItem = z.infer<typeof DocumentExtractLlmItemSchema>;
export type DocumentExtractLlmOutput = z.infer<typeof DocumentExtractLlmOutputSchema>;
