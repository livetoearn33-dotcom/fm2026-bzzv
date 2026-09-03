import type { Contact, Fact } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import { formatTodayLine } from "@/shared/prompts";

/**
 * /analyze 的 system prompt 組裝，照 prompts/README-組裝說明.md 的順序：
 * 引擎-analyze.md → 語氣-Zeno.md → 範例庫-回覆.md → 〈本次任務〉。
 */
export function buildAnalyzeSystemPrompt(layers: PromptLayers, taskBlock: string): string {
  return [layers.analyzeEngine, layers.tone, layers.examples, taskBlock].join("\n\n---\n\n");
}

function formatFactLine(fact: Fact): string {
  const suffix = fact.usage === "internal" ? "（內部參考，不得寫入回覆）" : "";
  return `- id: ${fact.id}｜${fact.label}｜${fact.content}${suffix}`;
}

export interface BuildAnalyzeTaskBlockInput {
  contact: Contact | undefined;
  /**
   * v0.2：截圖進來前後端還沒有對話文字，粗篩不了——塞入全部事實
   * （見 README-組裝說明.md「粗篩的雞生蛋問題」，量小塞得下）。
   */
  facts: Fact[];
  /** request 帶 draft 時才加〈使用者已打的草稿〉這段 */
  draft?: string;
  /** request 帶 persona 且找得到角色卡時，才加〈指定角色〉這段（角色卡全文） */
  personaCard?: string;
  /** 供測試注入固定時間；預設用真實現在時間 */
  now?: Date;
}

/**
 * 組第 4 層〈本次任務〉，格式對齊 README 的組裝範例。
 * 查無對象時走「未知（無檔案）」fallback（通用組裝規則第 2 點）。
 * 截圖本身不放進文字裡——由呼叫端另外組成 image content part 隨 messages 送出。
 */
export function buildAnalyzeTaskBlock(input: BuildAnalyzeTaskBlockInput): string {
  const { contact, facts, draft, personaCard, now } = input;

  const contactBlock = contact
    ? `對象：${contact.name}（${contact.role}）\n  語氣偏好：${contact.tone}\n  註記：${contact.notes}`
    : "對象：未知（無檔案）";

  const factsBlock = facts.length > 0
    ? facts.map(formatFactLine).join("\n")
    : "（無相關事實）";

  const lines = [
    "〈本次任務〉",
    formatTodayLine(now),
    contactBlock,
    "",
    "〈相關事實〉",
    factsBlock,
  ];

  if (draft) {
    lines.push(
      "",
      "〈使用者已打的草稿〉",
      draft,
      "使用者已經自己打了這段字，請以它為底改寫，保留他的原意與立場。",
    );
  }

  if (personaCard) {
    lines.push(
      "",
      "〈指定角色〉",
      personaCard,
    );
  }

  lines.push(
    "",
    "〈畫面〉",
    "（截圖以 image content part 附上，不放在文字裡）",
  );

  return lines.join("\n");
}
