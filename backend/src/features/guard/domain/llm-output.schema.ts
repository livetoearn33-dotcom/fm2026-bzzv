import { z } from "@hono/zod-openapi";

/**
 * generateText（Output.object）要求 LLM 產生的結構——對齊 prompts/引擎-guard.md 的「輸出格式」。
 * 用 discriminatedUnion 讓「沒命中」時不必產生 type/reason/spans/suggestion 這些欄位，
 * 貼合引擎檔 `{"flagged": false}` 的最簡輸出。
 */
export const GuardLlmOutputSchema = z.discriminatedUnion("flagged", [
  z.object({
    flagged: z.literal(true),
    type: z.enum(["defensive", "blame", "heat"]),
    reason: z.string(),
    spans: z.array(z.object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
      label: z.string(),
    })),
    suggestion: z.string(),
  }),
  z.object({
    flagged: z.literal(false),
  }),
]);

export type GuardLlmOutput = z.infer<typeof GuardLlmOutputSchema>;
