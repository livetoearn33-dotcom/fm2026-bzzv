import type { LanguageModel } from "ai";

import type { KnowledgeDocumentRepository, KnowledgeReader } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

/**
 * Service 依賴——model 可在測試中換成 mock（見 analyze/guard 既有慣例）；
 * documents 是 knowledge_documents 的儲存層；knowledge 只用來查現有 fact id
 * （suggestedId 撞名檢查，見 services/slug.ts）。
 */
export interface DocumentServiceDeps {
  model: LanguageModel;
  documents: KnowledgeDocumentRepository;
  knowledge: KnowledgeReader;
  promptLayers: PromptLayers;
}
