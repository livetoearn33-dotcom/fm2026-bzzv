import fs from "node:fs";
import path from "node:path";

import env from "@/env";

/**
 * prompts/ 是 /analyze、/guard 的唯一真源（見 prompts/README-組裝說明.md）。
 * 這裡只負責「讀檔」，不寫死任何 prompt 內容——Zeno 改檔即生效。
 */

export interface PromptLayers {
  /** 引擎-analyze.md：第 1 層，/analyze 專用 */
  analyzeEngine: string;
  /** 引擎-guard.md：第 1 層，/guard 專用 */
  guardEngine: string;
  /** 語氣-Zeno.md：第 2 層，兩支引擎共用 */
  tone: string;
  /** 範例庫-回覆.md：/analyze 第 3 層，全檔塞入不抽樣 */
  examples: string;
}

function resolvePromptsDir(): string {
  return env.PROMPTS_DIR ?? path.resolve(process.cwd(), "../prompts");
}

function readPrompt(filename: string, promptsDir: string): string {
  return fs.readFileSync(path.join(promptsDir, filename), "utf-8").trim();
}

export function loadPromptLayers(promptsDir: string = resolvePromptsDir()): PromptLayers {
  return {
    analyzeEngine: readPrompt("引擎-analyze.md", promptsDir),
    guardEngine: readPrompt("引擎-guard.md", promptsDir),
    tone: readPrompt("語氣-Zeno.md", promptsDir),
    examples: readPrompt("範例庫-回覆.md", promptsDir),
  };
}
