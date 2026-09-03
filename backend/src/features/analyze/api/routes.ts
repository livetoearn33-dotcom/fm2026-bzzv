import { createRoute } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "../validation/analyze.schema";

const tags = ["Analyze"];

/**
 * 截圖模式的 base64 字串上限：對應約 10MB 原始圖（base64 膨脹 4/3 ≈ 13.3MB）＋
 * JSON 其餘欄位與跳脫字元的緩衝。整支 request body 一起量，跟 documents 上傳
 * 用的 bodyLimit 是同一套慣例（見 features/documents/api/routes.ts）。
 */
const MAX_ANALYZE_BODY_BYTES = 14 * 1024 * 1024;

const analyzeBodyLimit = bodyLimit({
  maxSize: MAX_ANALYZE_BODY_BYTES,
  onError: c => c.json({ message: "截圖超過大小上限" }, HttpStatusCodes.REQUEST_TOO_LONG),
});

export const analyze = createRoute({
  method: "post",
  path: "/analyze",
  tags,
  operationId: "analyzeConversation",
  middleware: [analyzeBodyLimit] as const,
  request: {
    body: jsonContentRequired(
      AnalyzeRequestSchema,
      "截圖＋語氣，或對話內容與對象 id",
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
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("screenshot 是 data URL 格式但無法解析"),
      "截圖模式的 screenshot 是 data URL 卻無法解析",
    ),
    [HttpStatusCodes.REQUEST_TOO_LONG]: jsonContent(
      createMessageObjectSchema("截圖超過大小上限"),
      "截圖過大",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "上游 LLM 錯誤",
    ),
  },
});

export type AnalyzeRoute = typeof analyze;
