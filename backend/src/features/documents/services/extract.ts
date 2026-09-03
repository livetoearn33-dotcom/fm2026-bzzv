import type { LanguageModel } from "ai";

import { generateText, Output } from "ai";

import type { PromptLayers } from "@/shared/prompts";

import type { DocumentExtractLlmOutput } from "../domain/llm-output.schema";

import { DocumentExtractionError } from "../domain/errors";
import { DocumentExtractLlmOutputSchema } from "../domain/llm-output.schema";
import { buildDocumentExtractSystemPrompt, buildDocumentExtractTaskBlock } from "./build-prompt";

const TASK_TRIGGER_PROMPT = "請依照系統提示的規則與〈本次任務〉產生 JSON 輸出。";

/**
 * 呼叫 LLM 把 PDF 全文抽成事實草稿。失敗重試一次（沿用 analyze/guard 既有慣例），
 * 兩次都失敗才丟 DocumentExtractionError（回 502，不靜默回假資料）。
 */
export async function extractFactsFromDocument(
  model: LanguageModel,
  promptLayers: PromptLayers,
  input: { fileName: string; text: string },
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
      throw new DocumentExtractionError(`LLM 呼叫失敗或回傳不符 schema（已重試一次）：${message}`);
    }
  }
}
