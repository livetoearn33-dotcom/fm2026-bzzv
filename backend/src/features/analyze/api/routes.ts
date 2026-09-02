import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "../validation/analyze.schema";

const tags = ["Analyze"];

export const analyze = createRoute({
  method: "post",
  path: "/analyze",
  tags,
  operationId: "analyzeConversation",
  request: {
    body: jsonContentRequired(
      AnalyzeRequestSchema,
      "對話內容與對象 id",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      AnalyzeResponseSchema,
      "風險等級與建議回覆",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(AnalyzeRequestSchema),
      "驗證錯誤",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "上游 LLM 錯誤",
    ),
  },
});

export type AnalyzeRoute = typeof analyze;
