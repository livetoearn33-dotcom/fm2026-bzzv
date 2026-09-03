import { describe, expect, it } from "vitest";

import type { Contact, Fact } from "./types";

import { findContact, retrieveKnowledge, retrieveRelevantFacts } from "./retrieval";

const facts: Fact[] = [
  {
    id: "quote-standard-2026",
    label: "2026 標準報價",
    tags: ["報價", "價格", "方案"],
    content: "基礎方案 12 萬。",
    updatedAt: "2026-08-01",
    volatility: "high",
  },
  {
    id: "quote-floor-internal",
    label: "折扣底線（內部）",
    tags: ["報價", "折扣", "議價"],
    content: "最低可讓到 10.5 萬。",
    updatedAt: "2026-08-01",
    volatility: "high",
    usage: "internal",
  },
  {
    id: "proj-a-status",
    label: "A 案進度",
    tags: ["進度", "A案", "合約"],
    content: "卡在客戶端還沒回簽合約。",
    updatedAt: "2026-09-05",
    volatility: "high",
  },
];

const contacts: Contact[] = [
  {
    id: "boss-lin",
    name: "林經理",
    role: "主管",
    tone: "簡潔",
    notes: "在意時程",
    recentTopics: ["A 案進度"],
  },
];

describe("retrieveRelevantFacts", () => {
  it("用 tag 關鍵字命中相關事實，並依分數排序", () => {
    const result = retrieveRelevantFacts("這個進度到底怎麼樣了？下午要跟客戶開會。", facts);
    expect(result.map(f => f.id)).toEqual(["proj-a-status"]);
  });

  it("零命中回傳空陣列", () => {
    const result = retrieveRelevantFacts("今天天氣真好", facts);
    expect(result).toEqual([]);
  });

  it("usage: internal 的事實命中時仍會回傳（由呼叫端負責過濾，不進 sources）", () => {
    const result = retrieveRelevantFacts("報價可以再談嗎？折扣多少？", facts);
    expect(result.map(f => f.id)).toContain("quote-floor-internal");
  });

  it("limit 限制回傳筆數", () => {
    const result = retrieveRelevantFacts("報價 進度 合約", facts, 1);
    expect(result).toHaveLength(1);
  });
});

describe("findContact", () => {
  it("找到對應 contactId 的對象", () => {
    expect(findContact(contacts, "boss-lin")?.name).toBe("林經理");
  });

  it("contactId 不存在回傳 undefined，不丟例外", () => {
    expect(findContact(contacts, "not-exist")).toBeUndefined();
  });

  it("contactId 為 undefined 回傳 undefined", () => {
    expect(findContact(contacts, undefined)).toBeUndefined();
  });
});

describe("retrieveKnowledge", () => {
  it("同時回傳相關 facts 與對應 contact", () => {
    const result = retrieveKnowledge(
      "這個進度到底怎麼樣了？",
      "boss-lin",
      { facts, contacts },
    );
    expect(result.contact?.id).toBe("boss-lin");
    expect(result.facts.map(f => f.id)).toEqual(["proj-a-status"]);
  });
});
