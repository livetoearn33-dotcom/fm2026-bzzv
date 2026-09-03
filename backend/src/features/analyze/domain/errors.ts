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
 * LLM 讀完截圖判斷畫面上沒有對話（回 { error: "no_conversation" }）——
 * 這不是伺服器端的錯，是這張截圖本身沒東西可分析，回 422（見 README-組裝說明.md 契約重點第 6 點）。
 */
export class AnalyzeNoConversationError extends AppError {
  constructor() {
    super("這張畫面我讀不到對話", "ANALYZE_NO_CONVERSATION", HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
}

/**
 * request 帶了 persona 但找不到對應角色卡（見 shared/prompts/loader.ts 的角色卡對照表）——
 * request 本身的錯，回 400，跟 /persona 端點的 PersonaNotFoundError 行為一致。
 */
export class AnalyzePersonaNotFoundError extends AppError {
  constructor(personaId: string) {
    super(`未知的 persona：${personaId}`, "ANALYZE_PERSONA_NOT_FOUND", HttpStatusCodes.BAD_REQUEST);
  }
}
