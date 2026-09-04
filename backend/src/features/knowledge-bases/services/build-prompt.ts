import type { PromptLayers } from "@/shared/prompts";

import { formatTodayLine } from "@/shared/prompts";

/**
 * /v1/knowledge/documents 的 system prompt 組裝：單層，不疊語氣層
 * （見 prompts/引擎-extract-pdf.md 開頭說明）——引擎-extract-pdf.md ＋〈本次任務〉。
 */
export function buildDocumentExtractSystemPrompt(layers: PromptLayers, taskBlock: string): string {
  return [layers.extractPdfEngine, taskBlock].join("\n\n---\n\n");
}

export interface BuildDocumentExtractTaskBlockInput {
  fileName: string;
  text: string;
  /** 供測試注入固定時間；預設用真實現在時間 */
  now?: Date;
}

export function buildDocumentExtractTaskBlock(input: BuildDocumentExtractTaskBlockInput): string {
  const { fileName, text, now } = input;

  return [
    "〈本次任務〉",
    formatTodayLine(now),
    `檔名：${fileName}`,
    "",
    "〈文件內容〉",
    text,
  ].join("\n");
}
