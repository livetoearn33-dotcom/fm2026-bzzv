import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError } from "@/shared/errors";

/**
 * LLM 呼叫失敗、或重試後仍回傳不符 schema 的內容——回 502，不靜默回假資料。
 */
export class AnalyzeGenerationError extends AppError {
  constructor(message: string) {
    super(message, "ANALYZE_GENERATION_FAILED", HttpStatusCodes.BAD_GATEWAY);
  }
}

/**
 * 截圖模式的 `screenshot` 是 `data:` 開頭卻無法解析的字串（例如帶了非預期的參數，
 * 如 `data:image/png;name=shot.png;base64,...`）——400，不當成裸 base64 送給上游模型
 * （那會讓 provider 回 400、重試兩次後才變成誤導的 502，見 services/screenshot.ts）。
 */
export class InvalidScreenshotError extends AppError {
  constructor(message: string) {
    super(message, "INVALID_SCREENSHOT", HttpStatusCodes.BAD_REQUEST);
  }
}
