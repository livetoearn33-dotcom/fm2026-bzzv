import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { PersonaRequestSchema, PersonaResponseSchema } from "../validation/persona.schema";

const tags = ["Persona"];

export const persona = createRoute({
  method: "post",
  path: "/persona",
  tags,
  operationId: "rewritePersona",
  request: {
    body: jsonContentRequired(
      PersonaRequestSchema,
      "已生成的回覆原文與角色 id",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      PersonaResponseSchema,
      "角色改寫後的回覆",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("未知的 personaId，找不到對應角色卡"),
      "personaId 不合法",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(PersonaRequestSchema),
      "驗證錯誤",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗"),
      "上游 LLM 錯誤",
    ),
  },
});

export type PersonaRoute = typeof persona;
