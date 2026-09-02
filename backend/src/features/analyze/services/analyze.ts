import { generateObject } from "ai";

import type { Fact } from "@/shared/knowledge";

import { matchAnalyzeGoldenPath } from "@/shared/golden-path";
import { retrieveKnowledge } from "@/shared/knowledge";
import { computeSafeCard } from "@/shared/local-rules";

import type { AnalyzeFn, AnalyzeServiceDeps } from "../domain/entities";
import type { AnalyzeLlmOutput } from "../domain/llm-output.schema";
import type { AnalyzeResponse, AnalyzeSource } from "../validation/analyze.schema";

import { AnalyzeGenerationError } from "../domain/errors";
import { AnalyzeLlmOutputSchema } from "../domain/llm-output.schema";
import { buildAnalyzeSystemPrompt, buildAnalyzeTaskBlock } from "./build-prompt";

const TASK_TRIGGER_PROMPT = "請依照系統提示的規則與〈本次任務〉產生 JSON 輸出。";

/** sources 只列真的被塞進 context 的知識庫條目——用 id 對映回被檢索出的 facts，其餘（含幻覺 id、internal 事實）一律丟棄 */
function mapSources(ids: string[], injectedFacts: Fact[]): AnalyzeSource[] {
  const byId = new Map(injectedFacts.map(fact => [fact.id, fact]));
  const seen = new Set<string>();
  const sources: AnalyzeSource[] = [];

  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    const fact = byId.get(id);
    if (!fact || fact.usage === "internal") {
      continue;
    }
    seen.add(id);
    sources.push({ id: fact.id, label: fact.label });
  }

  return sources;
}

export function createAnalyzeService(deps: AnalyzeServiceDeps): AnalyzeFn {
  const { model, knowledge, promptLayers } = deps;

  return async (input) => {
    const start = performance.now();
    const { conversation, contactId } = input;
    const safeCard = computeSafeCard(conversation);

    // Golden path：demo 固定訊息，訊息文字完全相符就直接回準備好的 JSON，不打 LLM
    const goldenMatch = matchAnalyzeGoldenPath(conversation);
    if (goldenMatch) {
      const goldenFacts = knowledge.facts.filter(fact => goldenMatch.sourceIds.includes(fact.id));
      const response: AnalyzeResponse = {
        risk: goldenMatch.risk,
        riskReason: goldenMatch.riskReason,
        safeCard,
        reply: goldenMatch.reply,
        naiveReply: goldenMatch.naiveReply,
        sources: mapSources(goldenMatch.sourceIds, goldenFacts),
        latencyMs: Math.round(performance.now() - start),
      };
      return response;
    }

    const conversationText = conversation.map(message => message.text).join("\n");
    const { facts, contact } = retrieveKnowledge(conversationText, contactId, knowledge);

    const taskBlock = buildAnalyzeTaskBlock({ contact, facts, conversation, safeCard });
    const systemPrompt = buildAnalyzeSystemPrompt(promptLayers, taskBlock);

    const callModel = () => generateObject({
      model,
      schema: AnalyzeLlmOutputSchema,
      system: systemPrompt,
      prompt: TASK_TRIGGER_PROMPT,
    });

    let llmOutput: AnalyzeLlmOutput;
    try {
      llmOutput = (await callModel()).object;
    }
    catch {
      try {
        llmOutput = (await callModel()).object;
      }
      catch (secondError) {
        const message = secondError instanceof Error ? secondError.message : String(secondError);
        throw new AnalyzeGenerationError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
      }
    }

    // 回包驗證：reply 必須以 safeCard 開頭，不符就重打一次，再不符就退回 safeCard 本身當 reply
    if (!llmOutput.reply.startsWith(safeCard)) {
      try {
        const retryOutput = (await callModel()).object;
        llmOutput = retryOutput.reply.startsWith(safeCard)
          ? retryOutput
          : { ...retryOutput, reply: safeCard };
      }
      catch {
        llmOutput = { ...llmOutput, reply: safeCard };
      }
    }

    const response: AnalyzeResponse = {
      risk: llmOutput.risk,
      riskReason: llmOutput.riskReason,
      safeCard,
      reply: llmOutput.reply,
      naiveReply: llmOutput.naiveReply,
      sources: mapSources(llmOutput.sources, facts),
      latencyMs: Math.round(performance.now() - start),
    };

    return response;
  };
}
