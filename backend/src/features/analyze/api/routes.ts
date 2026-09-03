import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "../validation/analyze.schema";

const tags = ["Analyze"];

/**
 * 422 有兩種來源、兩種形狀：request body 沒過 zod 驗證（stoker 的標準錯誤形狀），
 * 或 request body 本身合法、但 LLM 讀完截圖判斷畫面上沒有對話
 * （AnalyzeNoConversationError，見 domain/errors.ts，回 {message} 形狀）。
 */
const AnalyzeUnprocessableEntitySchema = z.union([
  createErrorSchema(AnalyzeRequestSchema),
  createMessageObjectSchema("這張畫面我讀不到對話"),
]);

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
      AnalyzeUnprocessableEntitySchema,
      "驗證錯誤，或 LLM 判斷截圖上讀不到對話",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("未知的 persona"),
      "request 帶了不存在的角色卡 id",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "上游 LLM 錯誤",
    ),
  },
});

export type AnalyzeRoute = typeof analyze;
