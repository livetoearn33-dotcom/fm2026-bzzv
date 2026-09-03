import type { Contact, Fact } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import { formatTodayLine } from "@/shared/prompts";

import type { ConversationMessage } from "../validation/analyze.schema";

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

function formatConversation(conversation: ConversationMessage[]): string {
  return conversation
    .map(message => `${message.speaker === "them" ? "對方" : "我"}：${message.text}`)
    .join("\n");
}

export interface BuildAnalyzeTaskBlockInput {
  contact: Contact | undefined;
  facts: Fact[];
  conversation: ConversationMessage[];
  safeCard: string;
  /** 供測試注入固定時間；預設用真實現在時間 */
  now?: Date;
}

/**
 * 組第 4 層〈本次任務〉，格式對齊 README 的組裝範例。
 * 開頭注入今天日期行，查無對象時走「未知（無檔案）」fallback
 * （見 prompts/README-組裝說明.md「兩個引擎的通用組裝規則」第 1、2 點）。
 */
export function buildAnalyzeTaskBlock(input: BuildAnalyzeTaskBlockInput): string {
  const { contact, facts, conversation, safeCard, now } = input;

  const contactBlock = contact
    ? `對象：${contact.name}（${contact.role}）\n  語氣偏好：${contact.tone}\n  註記：${contact.notes}`
    : "對象：未知（無檔案）";

  const factsBlock = facts.length > 0
    ? facts.map(formatFactLine).join("\n")
    : "（無相關事實）";

  return [
    "〈本次任務〉",
    formatTodayLine(now),
    contactBlock,
    "",
    "〈相關事實〉",
    factsBlock,
    "",
    "〈對話〉",
    formatConversation(conversation),
    "",
    "〈安全牌〉（已在畫面上顯示）",
    safeCard,
    "你的 reply 必須以這句原文開頭，接著往下寫。",
  ].join("\n");
}
