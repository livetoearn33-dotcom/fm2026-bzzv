import type { Contact, Fact, KnowledgeStore } from "./types";

/**
 * 知識庫粗篩（spec 定案：資料量小，48 小時內不做向量檢索）。
 * 純函式、不碰檔案系統，方便單元測試。
 */

const DEFAULT_LIMIT = 5;

function scoreFact(fact: Fact, normalizedQuery: string): number {
  let score = 0;

  for (const tag of fact.tags) {
    if (tag && normalizedQuery.includes(tag.toLowerCase())) {
      score += 2;
    }
  }

  if (normalizedQuery.includes(fact.label.toLowerCase())) {
    score += 1;
  }

  return score;
}

/**
 * 用對話文字對 facts 的 tags／label 做關鍵字粗篩，回傳依分數排序的相關事實。
 * 零命中回傳空陣列（組裝時寫「（無相關事實）」）。
 */
export function retrieveRelevantFacts(
  conversationText: string,
  facts: Fact[],
  limit: number = DEFAULT_LIMIT,
): Fact[] {
  const normalizedQuery = conversationText.toLowerCase();

  return facts
    .map(fact => ({ fact, score: scoreFact(fact, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ fact }) => fact);
}

export function findContact(contacts: Contact[], contactId: string | undefined): Contact | undefined {
  if (!contactId) {
    return undefined;
  }
  return contacts.find(contact => contact.id === contactId);
}

export interface KnowledgeRetrievalResult {
  facts: Fact[];
  contact: Contact | undefined;
}

/**
 * 輸入對話文字＋contactId，輸出相關 facts 與 contact（純函式）。
 */
export function retrieveKnowledge(
  conversationText: string,
  contactId: string | undefined,
  store: KnowledgeStore,
  limit: number = DEFAULT_LIMIT,
): KnowledgeRetrievalResult {
  return {
    facts: retrieveRelevantFacts(conversationText, store.facts, limit),
    contact: findContact(store.contacts, contactId),
  };
}

/**
 * 截圖模式沒有文字可比對 tags，改用「全塞」策略：把全部事實排隊塞進 prompt，
 * 直到接近 token 預算為止（見 prompts/README-組裝說明.md「粗篩的雞生蛋問題」）。
 *
 * 沒有 tokenizer 依賴，用字數概算：中文內容抓「1.5 字 ≈ 1 token」的保守比例，
 * 換算成 maxChars。目前 17 筆事實遠低於預算，但知識庫可透過 PDF 匯入持續成長，
 * 這個上限是為了那個成長曲線準備的，不是裝飾用的參數。
 */
const CHARS_PER_TOKEN_ESTIMATE = 1.5;
export const DEFAULT_KNOWLEDGE_PROMPT_TOKEN_BUDGET = 4000;
export const DEFAULT_KNOWLEDGE_PROMPT_CHAR_BUDGET = Math.floor(
  DEFAULT_KNOWLEDGE_PROMPT_TOKEN_BUDGET * CHARS_PER_TOKEN_ESTIMATE,
);

export interface FactBudgetResult {
  /** 實際會被組進 prompt 的事實，依優先序（high volatility 優先）排列 */
  included: Fact[];
  /** 是否發生截斷 */
  truncated: boolean;
  /** 被捨棄的筆數 */
  omittedCount: number;
}

/** 估計單筆事實格式化成 prompt 一行後的字數（對齊 build-prompt.ts 的 formatFactLine 格式，抓保守值即可，不必逐字對齊） */
function estimateFactLineChars(fact: Fact): number {
  const internalSuffixChars = fact.usage === "internal" ? 12 : 0;
  return fact.id.length + fact.label.length + fact.content.length + internalSuffixChars + 10;
}

/**
 * 依 volatility 排序（high 優先——會過期的事實對「現在該怎麼回」更關鍵），
 * 依序塞入直到下一筆會超出字數預算為止；超出的筆數與提示留給呼叫端記 log。
 */
export function selectFactsWithinBudget(
  facts: Fact[],
  maxChars: number = DEFAULT_KNOWLEDGE_PROMPT_CHAR_BUDGET,
): FactBudgetResult {
  const prioritized = [...facts].sort((a, b) => {
    if (a.volatility === b.volatility) {
      return 0;
    }
    return a.volatility === "high" ? -1 : 1;
  });

  const included: Fact[] = [];
  let usedChars = 0;

  for (const fact of prioritized) {
    const lineChars = estimateFactLineChars(fact);
    if (usedChars + lineChars > maxChars) {
      break;
    }
    included.push(fact);
    usedChars += lineChars;
  }

  return {
    included,
    truncated: included.length < facts.length,
    omittedCount: facts.length - included.length,
  };
}
