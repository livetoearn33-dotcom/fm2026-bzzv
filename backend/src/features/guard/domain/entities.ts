import type { LanguageModel } from "ai";

import type { KnowledgeReader } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import type { GuardRequest, GuardResponse } from "../validation/guard.schema";

export interface GuardServiceDeps {
  model: LanguageModel;
  knowledge: KnowledgeReader;
  promptLayers: PromptLayers;
  /** LLM 失敗時退回示範資料；未指定時吃 env.MOCK_ON_LLM_ERROR（見 src/env.ts） */
  mockOnLlmError?: boolean;
}

export type GuardFn = (input: GuardRequest) => Promise<GuardResponse>;
