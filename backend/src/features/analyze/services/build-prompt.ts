import type { Contact, Fact } from "@/shared/knowledge";
import type { PromptLayers, ToneId } from "@/shared/prompts";

import { formatTodayLine } from "@/shared/prompts";

import type { ConversationMessage } from "../validation/analyze.schema";

/**
 * /analyze 的 system prompt 組裝，照 prompts/README-組裝說明.md 的順序：
 * 引擎-analyze.md → 語氣層 → 範例庫-回覆.md → 〈本次任務〉。
 * 語氣層：帶 tone（App 三顆按鈕之一）就用對應的 toneLayers，沒帶維持既有的
 * 語氣-Zeno.md 預設（向後相容，文字模式不帶 tone 時行為完全不變）。
 */
export function buildAnalyzeSystemPrompt(layers: PromptLayers, taskBlock: string, tone?: ToneId): string {
  const toneLayer = tone ? layers.toneLayers[tone] : layers.tone;
  return [layers.analyzeEngine, toneLayer, layers.examples, taskBlock].join("\n\n---\n\n");
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

export interface BuildAnalyzeScreenshotTaskBlockInput {
  contact: Contact | undefined;
  /** 知識庫全塞策略：呼叫端先用 selectFactsWithinBudget 篩過再傳進來 */
  facts: Fact[];
  /** 使用者已打在輸入框的字（選填） */
  draft?: string;
  /** 供測試注入固定時間；預設用真實現在時間 */
  now?: Date;
}

/**
 * 截圖模式的〈本次任務〉——沒有文字對話可組，改成請 LLM 自己讀圖。
 * 沒有安全牌可以先算（沒有文字可以跑本地關鍵字規則），改成請 LLM 把讀到的對話
 * 寫進 conversationText，後端事後用它跑 computeSafeCardForText（見 services/analyze.ts）。
 */
export function buildAnalyzeScreenshotTaskBlock(input: BuildAnalyzeScreenshotTaskBlockInput): string {
  const { contact, facts, draft, now } = input;

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

  lines.push(
    "",
    "〈畫面〉",
    "本次沒有文字對話，對話畫面以圖片內容附上（不在文字裡）。請先讀出畫面上的對話：誰在說話、說了什麼、順序如何。",
    "只讀畫面上真的有的字，看不清楚就不要猜內容；分不出對方與使用者時，以「最後一則是對方說的」為預設。",
    "把讀到的對話整理進 conversationText 欄位，每則一行、格式「them: 內容」或「me: 內容」，順序照畫面由上到下。",
    "畫面上讀不到任何對話時：risk 回 \"safe\"，riskReason、reply、naiveReply 都寫「這張畫面我讀不到對話，麻煩再截一次」，sources 回空陣列，conversationText 回空字串。",
  );

  return lines.join("\n");
}
