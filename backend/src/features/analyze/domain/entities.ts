import type { LanguageModel } from "ai";

import type { KnowledgeStore } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import type { AnalyzeRequest, AnalyzeResponse } from "../validation/analyze.schema";

/**
 * Service 依賴——model 從 src/shared/ai/model.ts 建立、可在測試中換成 mock，
 * 知識庫與 prompt layers 則是啟動時讀檔讀好的靜態資料。
 */
export interface AnalyzeServiceDeps {
  model: LanguageModel;
  knowledge: KnowledgeStore;
  promptLayers: PromptLayers;
}

export type AnalyzeFn = (input: AnalyzeRequest) => Promise<AnalyzeResponse>;
