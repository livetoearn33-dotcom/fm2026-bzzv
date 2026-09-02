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
