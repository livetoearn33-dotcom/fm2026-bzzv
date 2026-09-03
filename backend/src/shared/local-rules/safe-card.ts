/**
 * 分流機制的「本地規則」半（見 docs/spec.md「三個機制」第 1 節）。
 *
 * 目的：在打 LLM 之前，用零延遲的關鍵字／樣式比對先生出一張「安全牌」，
 * 讓前端 0.2 秒內先有東西可以顯示；LLM 之後只負責接著往下寫（reply）。
 * 規則刻意簡單——真正的判斷（風險等級、措辭）留給 LLM。
 */

export interface ConversationMessageLike {
  speaker: "them" | "me";
  text: string;
}

interface SafeCardRule {
  keywords: string[];
  card: string;
}

const SAFE_CARD_RULES: SafeCardRule[] = [
  {
    keywords: ["進度", "到底", "怎麼樣", "還要多久", "不是說好"],
    card: "收到，我確認一下進度",
  },
  {
    keywords: ["報價", "價格", "多少錢", "費用", "折扣", "比價"],
    card: "我確認一下報價，稍後回您",
  },
  {
    keywords: ["交期", "什麼時候", "出貨", "規格", "時程", "交貨"],
    card: "我確認時間後回您",
  },
];

const DEFAULT_CARD = "收到，我看一下";

function pickLastThemMessage(conversation: ConversationMessageLike[]): ConversationMessageLike | undefined {
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].speaker === "them") {
      return conversation[i];
    }
  }
  return conversation.at(-1);
}

/**
 * 對一段文字做關鍵字比對，選一張安全牌；落不進任何規則就回預設值。
 * 抽出成獨立函式供截圖模式使用——那裡沒有 ConversationMessageLike[]，
 * 只有 LLM 讀圖後回傳的 conversationText（見 features/analyze/domain/llm-output.schema.ts）。
 */
export function computeSafeCardForText(text: string): string {
  for (const rule of SAFE_CARD_RULES) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.card;
    }
  }

  return DEFAULT_CARD;
}

/**
 * 依對話最後一則「對方」訊息的關鍵字，選一張安全牌。
 * 落不進任何規則就回預設值——分流表裡「要查資料」的那一類最終還是靠 LLM 的 reply 補完整。
 */
export function computeSafeCard(conversation: ConversationMessageLike[]): string {
  const target = pickLastThemMessage(conversation);
  if (!target) {
    return DEFAULT_CARD;
  }

  return computeSafeCardForText(target.text);
}
