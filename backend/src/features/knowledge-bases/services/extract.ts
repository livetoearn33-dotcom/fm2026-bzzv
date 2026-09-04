import type { LanguageModel } from "ai";

import { generateText, Output } from "ai";

import type { PromptLayers } from "@/shared/prompts";

import type { DocumentExtractLlmOutput } from "../domain/llm-output.schema";

import { DocumentExtractionError } from "../domain/errors";
import { DocumentExtractLlmOutputSchema } from "../domain/llm-output.schema";
import { buildDocumentExtractSystemPrompt, buildDocumentExtractTaskBlock } from "./build-prompt";

const TASK_TRIGGER_PROMPT = "請依照系統提示的規則與〈本次任務〉產生 JSON 輸出。";

/** LLM 未接通時的示範抽取結果：從 PDF 實際文字取摘錄，條目都標「示範資料」。 */
function buildMockExtractOutput(input: { fileName: string; text: string }): DocumentExtractLlmOutput {
  const excerpt = input.text.replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    extracted: true,
    items: [
      {
        label: `${input.fileName} 內容摘錄（示範資料）`,
        content: `（示範資料）${excerpt}`,
        tags: ["示範資料"],
        volatility: "low",
      },
      {
        label: `${input.fileName} 待重抽（示範資料）`,
        content: "（示範資料）LLM 尚未接通，這批條目是預設內容；OPENAI_API_KEY 設定好後重新上傳這份 PDF 即可取得真正的抽取結果。",
        tags: ["示範資料"],
        volatility: "high",
      },
    ],
  };
}

/**
 * 呼叫 LLM 把 PDF 全文抽成事實草稿。失敗重試一次（沿用 analyze/guard 既有慣例），
 * 兩次都失敗時：mockOnError 開著就退回示範抽取結果（讓上傳→草稿→commit 整條可走），
 * 關著才丟 DocumentExtractionError（回 502）。
 */
export async function extractFactsFromDocument(
  model: LanguageModel,
  promptLayers: PromptLayers,
  input: { fileName: string; text: string },
  options: { mockOnError: boolean },
): Promise<DocumentExtractLlmOutput> {
  const taskBlock = buildDocumentExtractTaskBlock(input);
  const systemPrompt = buildDocumentExtractSystemPrompt(promptLayers, taskBlock);

  const callModel = () => generateText({
    model,
    output: Output.object({ schema: DocumentExtractLlmOutputSchema }),
    system: systemPrompt,
    prompt: TASK_TRIGGER_PROMPT,
  });

  try {
    return (await callModel()).output;
  }
  catch {
    try {
      return (await callModel()).output;
    }
    catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : String(secondError);
      if (options.mockOnError) {
        console.warn(`[knowledge-bases] LLM 失敗，退回示範抽取結果（MOCK_ON_LLM_ERROR）：${message}`);
        return buildMockExtractOutput(input);
      }
      throw new DocumentExtractionError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
    }
  }
}
