import { z } from "@hono/zod-openapi";

import { ProjectSchema } from "@/shared/knowledge";

/**
 * /v1/projects 的 request／response schema。
 * 單筆形狀直接衍生自 src/shared/knowledge/project-store.ts 的 zod 定義。
 */

export const ProjectListResponseSchema = z.array(ProjectSchema).openapi("ProjectList");

export const ProjectBodySchema = z.object({
  name: z.string().min(1).openapi({ example: "宏碩 Q4 報價案" }),
}).openapi("ProjectBody");

export const ProjectIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "b6b6f0d0-7f3e-4a1b-9c2d-000000000000",
  }),
}).openapi("ProjectIdParams");

export type ProjectBody = z.infer<typeof ProjectBodySchema>;
export type ProjectIdParams = z.infer<typeof ProjectIdParamsSchema>;
