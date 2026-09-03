import { generateText, Output } from "ai";

import type { Fact } from "@/shared/knowledge";

import { matchAnalyzeGoldenPath, matchPersonaGoldenPath } from "@/shared/golden-path";
import { findContact } from "@/shared/knowledge";
import { loadPersonaCard } from "@/shared/prompts";

import type { AnalyzeFn, AnalyzeServiceDeps } from "../domain/entities";
import type { AnalyzeLlmOutput, AnalyzeLlmSuccess } from "../domain/llm-output.schema";
import type { AnalyzeResponse, AnalyzeSource } from "../validation/analyze.schema";

import { AnalyzeGenerationError, AnalyzeNoConversationError, AnalyzePersonaNotFoundError } from "../domain/errors";
import { AnalyzeLlmOutputSchema, isAnalyzeLlmError } from "../domain/llm-output.schema";
import { buildAnalyzeSystemPrompt, buildAnalyzeTaskBlock } from "./build-prompt";

const TASK_TRIGGER_PROMPT = "請依照系統提示的規則讀這張截圖，並依〈本次任務〉產生 JSON 輸出。";

/** screenshot 是 request 已驗證過的 image data URL（見 validation/analyze.schema.ts 的 regex）；這裡只需要拆開餵給 SDK 的 FilePart */
function parseScreenshotDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) {
    throw new AnalyzeGenerationError("screenshot 不是合法的 base64 image data URL");
  }
  return { mediaType: match[1], base64: match[2] };
}

/** sources 只列真的被塞進 context 的知識庫條目——用 id 對映回 facts.json，其餘（含幻覺 id、internal 事實）一律丟棄 */
function mapSources(ids: string[], allFacts: Fact[]): AnalyzeSource[] {
  const byId = new Map(allFacts.map(fact => [fact.id, fact]));
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
    const { screenshot, draft, contactId, persona } = input;

    let personaCard: string | undefined;
    if (persona) {
      personaCard = loadPersonaCard(persona);
      if (!personaCard) {
        throw new AnalyzePersonaNotFoundError(persona);
      }
    }

    // v0.2：粗篩的雞生蛋問題——截圖進來前還沒有對話文字，無法先粗篩，
    // 塞入全部事實（量小塞得下，見 README-組裝說明.md）
    const contact = findContact(knowledge.contacts, contactId);
    const taskBlock = buildAnalyzeTaskBlock({ contact, facts: knowledge.facts, draft, personaCard });
    const systemPrompt = buildAnalyzeSystemPrompt(promptLayers, taskBlock);
    const { mediaType, base64 } = parseScreenshotDataUrl(screenshot);

    const callModel = () => generateText({
      model,
      output: Output.object({ schema: AnalyzeLlmOutputSchema }),
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: TASK_TRIGGER_PROMPT },
          { type: "file", mediaType, data: { type: "data", data: base64 } },
        ],
      }],
    });

    let llmOutput: AnalyzeLlmOutput;
    try {
      llmOutput = (await callModel()).output;
    }
    catch {
      try {
        llmOutput = (await callModel()).output;
      }
      catch (secondError) {
        const message = secondError instanceof Error ? secondError.message : String(secondError);
        throw new AnalyzeGenerationError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
      }
    }

    if (isAnalyzeLlmError(llmOutput)) {
      // 畫面上讀不到對話——不是伺服器錯誤，是這張截圖沒東西可分析
      throw new AnalyzeNoConversationError();
    }

    let success: AnalyzeLlmSuccess = llmOutput;

    // Golden path 二段式：LLM 已經讀圖產生 conversationText，後端拿它比對demo 劇本，
    // 命中就用快取覆蓋 LLM 產出（不再打第二次生成——目的是講稿穩定，不是變快）。
    const goldenMatch = matchAnalyzeGoldenPath(success.conversationText);
    if (goldenMatch) {
      // 只有沒指定角色、或指定的角色剛好有上台版快取（目前只有 zhuge）時才整段覆蓋；
      // 其他角色沒有對應的角色版快取，覆蓋等於送出未改寫的版本給一個要角色版的請求，
      // 這種情況寧可用當次 LLM 真的產出的結果，不要用半套的快取。
      const personaGolden = persona ? matchPersonaGoldenPath(persona, goldenMatch.reply) : undefined;
      if (!persona || personaGolden) {
        success = {
          conversationText: success.conversationText,
          risk: goldenMatch.risk,
          riskReason: goldenMatch.riskReason,
          reply: personaGolden ? personaGolden.reply : goldenMatch.reply,
          naiveReply: goldenMatch.naiveReply,
          sources: goldenMatch.sourceIds,
          ...(personaGolden ? { plainReply: goldenMatch.reply } : {}),
        };
      }
    }

    const response: AnalyzeResponse = {
      conversationText: success.conversationText,
      risk: success.risk,
      riskReason: success.riskReason,
      reply: success.reply,
      naiveReply: success.naiveReply,
      ...(success.plainReply ? { plainReply: success.plainReply } : {}),
      sources: mapSources(success.sources, knowledge.facts),
      latencyMs: Math.round(performance.now() - start),
    };

    return response;
  };
}
