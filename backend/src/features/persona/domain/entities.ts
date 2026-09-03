import type { LanguageModel } from "ai";

import type { PersonaRequest, PersonaResponse } from "../validation/persona.schema";

/**
 * Service 依賴——model 從 src/shared/ai/model.ts 建立、可在測試中換成 mock。
 * 角色卡由 shared/prompts/loader.ts 依 personaId 動態讀檔，不當成啟動時的靜態依賴
 * （對齊 /analyze、/guard 的 AnalyzeServiceDeps／GuardServiceDeps 慣例）。
 */
export interface PersonaServiceDeps {
  model: LanguageModel;
}

export type PersonaFn = (input: PersonaRequest) => Promise<PersonaResponse>;
