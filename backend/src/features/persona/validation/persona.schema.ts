import { z } from "@hono/zod-openapi";

/**
 * /persona 的 request／response schema。
 * 形狀對齊 prompts/README-組裝說明.md「角色改寫（persona，9/2 定案）」段：
 *
 * ```
 * POST /persona
 * Request:  { "reply": "<已生成的回覆原文>", "conversation": [...], "persona": "zhuge" }
 * Response: { "reply": "<角色版回覆>" }
 * ```
 *
 * `persona` 刻意用 `string`、不用 zod enum——角色卡檔案是真源（README 明文：
 * 「新角色＝加一個 .md，程式不用改」），personaId 合不合法要看
 * prompts/角色卡-*.md 有沒有對應的檔案（見 shared/prompts/loader.ts），
 * 不是在 schema 這層鎖死列舉值。找不到對應角色卡回 400（見 domain/errors.ts）。
 */

export const PersonaConversationMessageSchema = z.object({
  speaker: z.enum(["them", "me"]),
  text: z.string(),
  ts: z.string().optional(),
});

export const PersonaRequestSchema = z.object({
  reply: z.string().min(1),
  conversation: z.array(PersonaConversationMessageSchema).default([]),
  persona: z.string().min(1),
}).openapi("PersonaRequest");

export const PersonaResponseSchema = z.object({
  reply: z.string(),
}).openapi("PersonaResponse");

export type PersonaConversationMessage = z.infer<typeof PersonaConversationMessageSchema>;
export type PersonaRequest = z.infer<typeof PersonaRequestSchema>;
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;
