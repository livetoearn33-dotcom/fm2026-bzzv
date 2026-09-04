import { generateText, Output } from "ai";

import env from "@/env";
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

/** LLM 未接通時的示範規則門檻：draft 超過這個字數就回警告（MOCK_ON_LLM_ERROR，見 src/env.ts）。 */
const MOCK_DRAFT_LENGTH_THRESHOLD = 15;

export function createGuardService(deps: GuardServiceDeps): GuardFn {
  const { model, knowledge, promptLayers } = deps;
  const mockOnLlmError = deps.mockOnLlmError ?? env.MOCK_ON_LLM_ERROR;

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

    const contacts = await knowledge.listContacts();
    const contact = findContact(contacts, contactId);
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
        if (mockOnLlmError) {
          // LLM 未接通的示範規則：draft 超過 15 字就回警告＋原因＋改善建議，
          // 讓前端「命中風險→顯示 reason→按改善填回」整條互動先能 demo；
          // 15 字以內退回本地驚嘆號規則訊號。
          console.warn(`[guard] LLM 失敗，退回示範規則（MOCK_ON_LLM_ERROR）：${message}`);
          if (draft.length > MOCK_DRAFT_LENGTH_THRESHOLD) {
            const response: GuardResponse = {
              flagged: true,
              type: "heat",
              reason: "（示範資料）這句話偏長，對方可能覺得資訊太多、重點被稀釋——LLM 接通後這裡會是真正的語氣分析",
              spans: localSignal.flagged ? localSignal.spans : [],
              suggestion: `${draft.slice(0, MOCK_DRAFT_LENGTH_THRESHOLD)}（示範：精簡後的版本會出現在這裡）`,
            };
            return response;
          }
          return mergeGuardSignals({ flagged: false }, localSignal);
        }
        throw new GuardGenerationError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
      }
    }

    return mergeGuardSignals(llmOutput, localSignal);
  };
}
