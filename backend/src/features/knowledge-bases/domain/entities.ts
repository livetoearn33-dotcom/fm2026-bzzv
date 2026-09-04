import type { LanguageModel } from "ai";

import type { KnowledgeBaseRepository, KnowledgeReader } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

/**
 * Service 依賴——model 可在測試中換成 mock（見 analyze/guard 既有慣例）；
 * bases 是 knowledge_bases＋knowledge_documents 的儲存層；knowledge 只用來查
 * 現有 fact id（suggestedId 撞名檢查，見 services/slug.ts）。
 */
export interface KnowledgeBaseServiceDeps {
  model: LanguageModel;
  bases: KnowledgeBaseRepository;
  knowledge: KnowledgeReader;
  promptLayers: PromptLayers;
  /** LLM 失敗時退回示範抽取條目；未指定時吃 env.MOCK_ON_LLM_ERROR（見 src/env.ts） */
  mockOnLlmError?: boolean;
}
