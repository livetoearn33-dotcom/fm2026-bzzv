import { generateText, Output } from "ai";

import { matchGuardGoldenPath } from "@/shared/golden-path";
import { findContact } from "@/shared/knowledge";
import { detectHeatSignal } from "@/shared/local-rules";

import type { GuardFn, GuardServiceDeps } from "../domain/entities";
import type { GuardResponse } from "../validation/guard.schema";

import { GuardGenerationError } from "../domain/errors";
import { GuardLlmOutputSchema } from "../domain/llm-output.schema";
import { buildGuardSystemPrompt, buildGuardTaskBlock } from "./build-prompt";
import { mergeGuardSignals } from "./merge-signals";

const TASK_TRIGGER_PROMPT = "請依照系統提示的規則與〈本次任務〉產生 JSON 輸出。";

export function createGuardService(deps: GuardServiceDeps): GuardFn {
  const { model, knowledge, promptLayers } = deps;

  return async (input) => {
    const { draft, conversation, contactId } = input;

    const localSignal = detectHeatSignal(draft);

    // Golden path：demo 第二幕那句草稿完全相符就直接回準備好的 JSON，不打 LLM
    const goldenMatch = matchGuardGoldenPath(draft);
    if (goldenMatch) {
      const response: GuardResponse = {
        flagged: true,
        type: goldenMatch.type,
        reason: goldenMatch.reason,
        spans: goldenMatch.spans,
        suggestion: goldenMatch.suggestion,
      };
      return response;
    }

    const contact = findContact(knowledge.contacts, contactId);
    const taskBlock = buildGuardTaskBlock({ contact, conversation, draft });
    const systemPrompt = buildGuardSystemPrompt(promptLayers, taskBlock);

    const callModel = () => generateText({
      model,
      output: Output.object({ schema: GuardLlmOutputSchema }),
      system: systemPrompt,
      prompt: TASK_TRIGGER_PROMPT,
    });

    let llmOutput;
    try {
      llmOutput = (await callModel()).output;
    }
    catch {
      try {
        llmOutput = (await callModel()).output;
      }
      catch (secondError) {
        const message = secondError instanceof Error ? secondError.message : String(secondError);
        throw new GuardGenerationError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
      }
    }

    return mergeGuardSignals(llmOutput, localSignal);
  };
}
