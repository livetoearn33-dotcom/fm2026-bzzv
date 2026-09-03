import { generateText, Output } from "ai";

import type { Fact } from "@/shared/knowledge";

import { matchAnalyzeGoldenPath } from "@/shared/golden-path";
import { findContact, retrieveKnowledge, selectFactsWithinBudget } from "@/shared/knowledge";
import { computeSafeCard, computeSafeCardForText } from "@/shared/local-rules";

import type { AnalyzeFn, AnalyzeServiceDeps } from "../domain/entities";
import type { AnalyzeLlmOutput } from "../domain/llm-output.schema";
import type { AnalyzeResponse, AnalyzeSource, ScreenshotAnalyzeRequest, TextAnalyzeRequest } from "../validation/analyze.schema";

import { AnalyzeGenerationError } from "../domain/errors";
import { AnalyzeLlmOutputSchema } from "../domain/llm-output.schema";
import { buildAnalyzeScreenshotTaskBlock, buildAnalyzeSystemPrompt, buildAnalyzeTaskBlock } from "./build-prompt";
import { normalizeScreenshot } from "./screenshot";

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

/**
 * 呼叫一次 LLM 失敗就重打一次，兩次都失敗才丟 AnalyzeGenerationError（回 502，不靜默回假資料）。
 * 文字模式、截圖模式共用同一套重試邏輯。
 */
async function generateWithRetry(callModel: () => Promise<{ output: AnalyzeLlmOutput }>): Promise<AnalyzeLlmOutput> {
  try {
    return (await callModel()).output;
  }
  catch {
    try {
      return (await callModel()).output;
    }
    catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      throw new AnalyzeGenerationError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
    }
  }
}

export function createAnalyzeService(deps: AnalyzeServiceDeps): AnalyzeFn {
  const { model, knowledge, promptLayers } = deps;

  async function runTextAnalyze(input: TextAnalyzeRequest, start: number): Promise<AnalyzeResponse> {
    const { conversation, contactId, tone } = input;
    const safeCard = computeSafeCard(conversation);

    // 每次請求都重新查 DB，PUT/DELETE 之後立刻可見（不是啟動時的靜態快照）。
    const [facts, contacts] = await Promise.all([knowledge.listFacts(), knowledge.listContacts()]);

    // Golden path：demo 固定訊息，訊息文字完全相符就直接回準備好的 JSON，不打 LLM
    const goldenMatch = matchAnalyzeGoldenPath(conversation);
    if (goldenMatch) {
      const goldenFacts = facts.filter(fact => goldenMatch.sourceIds.includes(fact.id));
      return {
        risk: goldenMatch.risk,
        riskReason: goldenMatch.riskReason,
        safeCard,
        reply: goldenMatch.reply,
        naiveReply: goldenMatch.naiveReply,
        sources: mapSources(goldenMatch.sourceIds, goldenFacts),
        latencyMs: Math.round(performance.now() - start),
      };
    }

    const conversationText = conversation.map(message => message.text).join("\n");
    const { facts: relevantFacts, contact } = retrieveKnowledge(conversationText, contactId, { facts, contacts });

    const taskBlock = buildAnalyzeTaskBlock({ contact, facts: relevantFacts, conversation, safeCard });
    const systemPrompt = buildAnalyzeSystemPrompt(promptLayers, taskBlock, tone);

    const callModel = () => generateText({
      model,
      output: Output.object({ schema: AnalyzeLlmOutputSchema }),
      system: systemPrompt,
      prompt: TASK_TRIGGER_PROMPT,
    });

    let llmOutput = await generateWithRetry(callModel);

    // 回包驗證：reply 必須以 safeCard 開頭，不符就重打一次，再不符就退回 safeCard 本身當 reply
    if (!llmOutput.reply.startsWith(safeCard)) {
      try {
        const retryOutput = (await callModel()).output;
        llmOutput = retryOutput.reply.startsWith(safeCard)
          ? retryOutput
          : { ...retryOutput, reply: safeCard };
      }
      catch {
        llmOutput = { ...llmOutput, reply: safeCard };
      }
    }

    return {
      risk: llmOutput.risk,
      riskReason: llmOutput.riskReason,
      safeCard,
      reply: llmOutput.reply,
      naiveReply: llmOutput.naiveReply,
      sources: mapSources(llmOutput.sources, relevantFacts),
      latencyMs: Math.round(performance.now() - start),
    };
  }

  async function runScreenshotAnalyze(input: ScreenshotAnalyzeRequest, start: number): Promise<AnalyzeResponse> {
    const { screenshot, screenshotMimeType, tone, contactId, draft } = input;
    const { data, mediaType } = normalizeScreenshot(screenshot, screenshotMimeType);

    // 沒有文字可以粗篩（雞生蛋問題，見 prompts/README-組裝說明.md），改成知識庫全塞策略：
    // 全部事實依 volatility 排序塞進 prompt，直到接近 token 預算，超過就截斷並記 log。
    const [facts, contacts] = await Promise.all([knowledge.listFacts(), knowledge.listContacts()]);
    const contact = findContact(contacts, contactId);
    const { included: budgetedFacts, truncated, omittedCount } = selectFactsWithinBudget(facts);
    if (truncated) {
      console.warn(
        `[analyze] 截圖模式知識庫超過 prompt token 預算，截斷 ${omittedCount} 筆事實（總共 ${facts.length} 筆）`,
      );
    }

    const taskBlock = buildAnalyzeScreenshotTaskBlock({ contact, facts: budgetedFacts, draft });
    const systemPrompt = buildAnalyzeSystemPrompt(promptLayers, taskBlock, tone);

    const callModel = () => generateText({
      model,
      output: Output.object({ schema: AnalyzeLlmOutputSchema }),
      system: systemPrompt,
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: TASK_TRIGGER_PROMPT },
            { type: "file" as const, mediaType, data },
          ],
        },
      ],
    });

    const llmOutput = await generateWithRetry(callModel);

    // 截圖模式沒有預先算好的安全牌（沒有文字可以先跑本地關鍵字規則），
    // 改成事後用 LLM 讀圖辨識出的 conversationText 跑同一套規則。不強制 reply
    // 以它為開頭——那個約束是文字模式「先給安全牌、reply 接著長出來」的產物，
    // 截圖模式整個回應是同一次呼叫生出來的，沒有那個時序前提。
    const safeCard = computeSafeCardForText(llmOutput.conversationText ?? "");

    return {
      risk: llmOutput.risk,
      riskReason: llmOutput.riskReason,
      safeCard,
      reply: llmOutput.reply,
      naiveReply: llmOutput.naiveReply,
      sources: mapSources(llmOutput.sources, budgetedFacts),
      latencyMs: Math.round(performance.now() - start),
    };
  }

  return async (input) => {
    const start = performance.now();

    if ("screenshot" in input) {
      return runScreenshotAnalyze(input, start);
    }

    return runTextAnalyze(input, start);
  };
}
