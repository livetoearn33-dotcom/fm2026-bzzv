import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError } from "@/shared/errors";

/**
 * personaId 找不到對應角色卡（見 shared/prompts/loader.ts 的角色卡對照表，或
 * prompts/角色卡-*.md 檔案本身不存在）——回 400，不是伺服器端的錯，是 request 錯。
 */
export class PersonaNotFoundError extends AppError {
  constructor(personaId: string) {
    super(`未知的 personaId：${personaId}`, "PERSONA_NOT_FOUND", HttpStatusCodes.BAD_REQUEST);
  }
}

/**
 * LLM 呼叫失敗、或重試後仍失敗——回 502，不靜默回假資料。
 * 與 /analyze、/guard 的錯誤處理保持一致。
 */
export class PersonaGenerationError extends AppError {
  constructor(message: string) {
    super(message, "PERSONA_GENERATION_FAILED", HttpStatusCodes.BAD_GATEWAY);
  }
}
