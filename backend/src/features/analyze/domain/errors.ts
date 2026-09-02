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
