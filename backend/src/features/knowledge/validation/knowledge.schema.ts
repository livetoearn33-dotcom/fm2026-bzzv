import { z } from "@hono/zod-openapi";

import { ContactSchema, FactSchema } from "@/shared/knowledge";

/**
 * /v1/contacts、/v1/facts 的 request／response schema。
 * 單筆形狀直接衍生自 src/shared/knowledge/types.ts 的 zod 定義，不重複定義欄位。
 */

export const ContactListResponseSchema = z.array(ContactSchema).openapi("ContactList");
export const FactListResponseSchema = z.array(FactSchema).openapi("FactList");

/** PUT body 是整筆內容不含 id（id 取自路徑）。 */
export const ContactPutBodySchema = ContactSchema.omit({ id: true }).openapi("ContactPutBody");

/** facts 的 updatedAt 可省略，省略時後端補今天日期（見 DbKnowledgeStore.upsertFact）。 */
export const FactPutBodySchema = FactSchema.omit({ id: true }).extend({
  updatedAt: FactSchema.shape.updatedAt.optional(),
}).openapi("FactPutBody");

export const KnowledgeIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "boss-lin",
  }),
}).openapi("KnowledgeIdParams");

export type ContactPutBody = z.infer<typeof ContactPutBodySchema>;
export type FactPutBody = z.infer<typeof FactPutBodySchema>;
export type KnowledgeIdParams = z.infer<typeof KnowledgeIdParamsSchema>;
