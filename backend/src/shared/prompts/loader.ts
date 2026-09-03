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

/**
 * /persona 的角色卡對照表（見 prompts/README-組裝說明.md「角色改寫」段）：
 * zhuge=諸葛亮｜ceo=霸道總裁｜charmer=情場達人。
 * 角色卡「檔案內容」是真源（Zeno 改檔即生效），但 personaId → 檔名的對照
 * 是固定的一小張表——新增角色卡時要在這裡補一行。
 */
const PERSONA_CARD_FILENAMES: Record<string, string> = {
  zhuge: "角色卡-諸葛亮.md",
  ceo: "角色卡-霸道總裁.md",
  charmer: "角色卡-情場達人.md",
};

export function isKnownPersonaId(personaId: string): boolean {
  return Object.hasOwn(PERSONA_CARD_FILENAMES, personaId);
}

/** 找不到對應角色卡（未知 personaId，或檔案被刪了）回 undefined，由呼叫端決定要不要當 400 */
export function loadPersonaCard(personaId: string, promptsDir: string = resolvePromptsDir()): string | undefined {
  const filename = PERSONA_CARD_FILENAMES[personaId];
  if (!filename) {
    return undefined;
  }
  const filePath = path.join(promptsDir, filename);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return readPrompt(filename, promptsDir);
}
