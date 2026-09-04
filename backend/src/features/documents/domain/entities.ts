import type { LanguageModel } from "ai";

import type { KnowledgeDocumentRepository, KnowledgeReader, ProjectRepository } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

/**
 * Service 依賴——model 可在測試中換成 mock（見 analyze/guard 既有慣例）；
 * documents 是 knowledge_documents 的儲存層；knowledge 只用來查現有 fact id
 * （suggestedId 撞名檢查，見 services/slug.ts）；projects 用於上傳時
 * 以 projectName 找同名或自動建立專案（對應 Android「新增知識庫」一步式流程）。
 */
export interface DocumentServiceDeps {
  model: LanguageModel;
  documents: KnowledgeDocumentRepository;
  knowledge: KnowledgeReader;
  projects: ProjectRepository;
  promptLayers: PromptLayers;
}
