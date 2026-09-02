import type { LanguageModel } from "ai";

import type { KnowledgeStore } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import type { GuardRequest, GuardResponse } from "../validation/guard.schema";

export interface GuardServiceDeps {
  model: LanguageModel;
  knowledge: KnowledgeStore;
  promptLayers: PromptLayers;
}

export type GuardFn = (input: GuardRequest) => Promise<GuardResponse>;
