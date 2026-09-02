import { z } from "@hono/zod-openapi";

/**
 * /guard 的 request／response schema。
 * 形狀嚴格對齊 docs/spec.md「API 介面」段的 /guard。
 */

export const GuardConversationMessageSchema = z.object({
  speaker: z.enum(["them", "me"]),
  text: z.string(),
  ts: z.string().optional(),
});

export const GuardRequestSchema = z.object({
  draft: z.string(),
  conversation: z.array(GuardConversationMessageSchema).default([]),
  contactId: z.string().optional(),
}).openapi("GuardRequest");

export const GuardSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  label: z.string(),
});

export const GuardTypeSchema = z.enum(["defensive", "blame", "heat"]);

export const GuardResponseSchema = z.object({
  flagged: z.boolean(),
  /** 沒命中時為 null */
  type: GuardTypeSchema.nullable(),
  /** 沒命中時為空字串 */
  reason: z.string(),
  /** 沒命中時為空陣列 */
  spans: z.array(GuardSpanSchema),
  /** 沒命中時為 null */
  suggestion: z.string().nullable(),
}).openapi("GuardResponse");

export type GuardConversationMessage = z.infer<typeof GuardConversationMessageSchema>;
export type GuardRequest = z.infer<typeof GuardRequestSchema>;
export type GuardSpan = z.infer<typeof GuardSpanSchema>;
export type GuardType = z.infer<typeof GuardTypeSchema>;
export type GuardResponse = z.infer<typeof GuardResponseSchema>;
