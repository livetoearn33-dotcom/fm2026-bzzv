import type { LanguageModel } from "ai";

import type { KnowledgeReader } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import type { AnalyzeRequest, AnalyzeResponse } from "../validation/analyze.schema";

/**
 * Service 依賴——model 從 src/shared/ai/model.ts 建立、可在測試中換成 mock；
 * knowledge 現在是 DB-backed 的非同步讀取介面，每次 /analyze 都會查到當下最新資料。
 */
export interface AnalyzeServiceDeps {
  model: LanguageModel;
  knowledge: KnowledgeReader;
  promptLayers: PromptLayers;
}

export type AnalyzeFn = (input: AnalyzeRequest) => Promise<AnalyzeResponse>;
