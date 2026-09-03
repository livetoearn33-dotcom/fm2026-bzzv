import { z } from "@hono/zod-openapi";

/**
 * /analyze 的 request／response schema。
 * 形狀嚴格對齊 docs/spec.md「API 介面」段的 /analyze。
 */

export const ConversationMessageSchema = z.object({
  speaker: z.enum(["them", "me"]),
  text: z.string(),
  ts: z.string(),
});

export const AnalyzeRequestSchema = z.object({
  conversation: z.array(ConversationMessageSchema).min(1),
  contactId: z.string().optional(),
}).openapi("AnalyzeRequest");

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
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalyzeSource = z.infer<typeof AnalyzeSourceSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
