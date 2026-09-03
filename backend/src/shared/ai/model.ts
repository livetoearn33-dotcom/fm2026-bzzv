import type { LanguageModel } from "ai";

import { openai } from "@ai-sdk/openai";

import env from "@/env";

/**
 * 建立呼叫 OpenAI 的語言模型實例。
 *
 * 型號選擇：`gpt-5-mini`（見 @ai-sdk/openai 型別定義 OpenAIChatModelId 目前收錄的現行世代）。
 * 選它的理由：
 * - /analyze、/guard 都是「短輸入、短結構化輸出」的任務，不需要旗艦模型的推理深度
 * - mini 級距在延遲與價格上明顯優於 gpt-5 全尺寸，符合 demo 對 latencyMs 的要求
 * - 支援 generateText + Output.object 的結構化輸出
 * 可用 `OPENAI_MODEL` 環境變數覆蓋。
 */
export function createLanguageModel(): LanguageModel {
  return openai(env.OPENAI_MODEL);
}
