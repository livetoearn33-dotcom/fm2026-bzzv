import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { GuardRequestSchema, GuardResponseSchema } from "../validation/guard.schema";

const tags = ["Guard"];

export const guard = createRoute({
  method: "post",
  path: "/guard",
  tags,
  operationId: "guardDraft",
  request: {
    body: jsonContentRequired(
      GuardRequestSchema,
      "使用者自己打的草稿與對話上下文",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      GuardResponseSchema,
      "是否命中風險語氣與潤飾建議",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(GuardRequestSchema),
      "驗證錯誤",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "上游 LLM 錯誤",
    ),
  },
});

export type GuardRoute = typeof guard;
