import fs from "node:fs";
import path from "node:path";

import env from "@/env";

/**
 * prompts/ 是 /analyze、/guard 的唯一真源（見 prompts/README-組裝說明.md）。
 * 這裡只負責「讀檔」，不寫死任何 prompt 內容——Zeno 改檔即生效。
 */

/** App 已實作的三顆語氣按鈕（見 analyze.schema.ts 的 AnalyzeToneSchema）對應的語氣層 */
export type ToneId = "empathy" | "concise" | "affirmative";

const TONE_FILENAMES: Record<ToneId, string> = {
  empathy: "語氣-同理.md",
  concise: "語氣-簡潔.md",
  affirmative: "語氣-肯定.md",
};

export interface PromptLayers {
  /** 引擎-analyze.md：第 1 層，/analyze 專用 */
  analyzeEngine: string;
  /** 引擎-guard.md：第 1 層，/guard 專用 */
  guardEngine: string;
  /** 語氣-Zeno.md：第 2 層預設值，兩支引擎共用；/analyze 帶 tone 參數時改用 toneLayers 對應那份 */
  tone: string;
  /** App 三顆語氣按鈕各自的第 2 層內容，key 為 AnalyzeTone */
  toneLayers: Record<ToneId, string>;
  /** 範例庫-回覆.md：/analyze 第 3 層，全檔塞入不抽樣 */
  examples: string;
  /** 引擎-extract-pdf.md：第 1 層，POST /v1/knowledge/documents 的 PDF 抽取專用（單層，不疊語氣層） */
  extractPdfEngine: string;
}

/**
 * 沒設 PROMPTS_DIR 時的預設順序：先找 repo 根目錄的 `../prompts`（本機開發、
 * build context 是 repo 根目錄時都在），不存在再退回 `assets/prompts`
 * （build context 只有 backend/ 時的副本，見 scripts/sync-assets.mjs）。
 */
function resolvePromptsDir(): string {
  if (env.PROMPTS_DIR) {
    return env.PROMPTS_DIR;
  }
  const repoRootPromptsDir = path.resolve(process.cwd(), "../prompts");
  if (fs.existsSync(repoRootPromptsDir)) {
    return repoRootPromptsDir;
  }
  return path.resolve(process.cwd(), "assets/prompts");
}

function readPrompt(filename: string, promptsDir: string): string {
  return fs.readFileSync(path.join(promptsDir, filename), "utf-8").trim();
}

export function loadPromptLayers(promptsDir: string = resolvePromptsDir()): PromptLayers {
  return {
    analyzeEngine: readPrompt("引擎-analyze.md", promptsDir),
    guardEngine: readPrompt("引擎-guard.md", promptsDir),
    tone: readPrompt("語氣-Zeno.md", promptsDir),
    toneLayers: {
      empathy: readPrompt(TONE_FILENAMES.empathy, promptsDir),
      concise: readPrompt(TONE_FILENAMES.concise, promptsDir),
      affirmative: readPrompt(TONE_FILENAMES.affirmative, promptsDir),
    },
    examples: readPrompt("範例庫-回覆.md", promptsDir),
    extractPdfEngine: readPrompt("引擎-extract-pdf.md", promptsDir),
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
