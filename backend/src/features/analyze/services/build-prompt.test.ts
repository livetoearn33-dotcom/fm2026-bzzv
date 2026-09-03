import { describe, expect, it } from "vitest";

import type { Contact, Fact } from "@/shared/knowledge";

import { buildAnalyzeSystemPrompt, buildAnalyzeTaskBlock } from "./build-prompt";

const contact: Contact = {
  id: "boss-lin",
  name: "林經理",
  role: "主管",
  tone: "簡潔、先講結論",
  notes: "在意時程",
  recentTopics: ["A 案進度"],
};

const facts: Fact[] = [
  {
    id: "proj-a-status",
    label: "A 案進度",
    tags: ["進度"],
    content: "卡在客戶端還沒回簽合約。",
    updatedAt: "2026-09-05",
    volatility: "high",
  },
  {
    id: "quote-floor-internal",
    label: "折扣底線",
    tags: ["折扣"],
    content: "最低可讓到 10.5 萬。",
    updatedAt: "2026-08-01",
    volatility: "high",
    usage: "internal",
  },
];

describe("buildAnalyzeTaskBlock", () => {
  it("組出對象、事實、對話、安全牌四段，internal 事實標註不得寫入回覆", () => {
    const block = buildAnalyzeTaskBlock({
      contact,
      facts,
      conversation: [{ speaker: "them", text: "進度到底怎樣了？", ts: "2026-09-06T00:00:00Z" }],
      safeCard: "收到，我確認一下進度",
    });

    expect(block).toContain("對象：林經理（主管）");
    expect(block).toContain("id: proj-a-status｜A 案進度｜卡在客戶端還沒回簽合約。");
    expect(block).toContain("（內部參考，不得寫入回覆）");
    expect(block).toContain("對方：進度到底怎樣了？");
    expect(block).toContain("你的 reply 必須以這句原文開頭，接著往下寫。");
  });

  it("沒有相關事實時寫「（無相關事實）」", () => {
    const block = buildAnalyzeTaskBlock({
      contact,
      facts: [],
      conversation: [{ speaker: "them", text: "哈囉", ts: "2026-09-06T00:00:00Z" }],
      safeCard: "收到，我看一下",
    });
    expect(block).toContain("（無相關事實）");
  });

  it("沒有對象資料時寫「未知（無檔案）」", () => {
    const block = buildAnalyzeTaskBlock({
      contact: undefined,
      facts: [],
      conversation: [{ speaker: "them", text: "哈囉", ts: "2026-09-06T00:00:00Z" }],
      safeCard: "收到，我看一下",
    });
    expect(block).toContain("對象：未知（無檔案）");
  });

  it("開頭注入今天日期行（週幾對照週日=0）", () => {
    const block = buildAnalyzeTaskBlock({
      contact,
      facts: [],
      conversation: [{ speaker: "them", text: "這週來得及嗎？", ts: "2026-09-06T00:00:00Z" }],
      safeCard: "收到，我看一下",
      now: new Date(2026, 8, 6), // 2026-09-06 是週日
    });
    expect(block).toContain("今天是 2026-09-06（週日）");
  });
});

describe("buildAnalyzeSystemPrompt", () => {
  it("依序串接引擎、語氣、範例庫、本次任務四層", () => {
    const prompt = buildAnalyzeSystemPrompt(
      { analyzeEngine: "ENGINE", guardEngine: "GUARD", tone: "TONE", examples: "EXAMPLES" },
      "TASK_BLOCK",
    );
    const engineIndex = prompt.indexOf("ENGINE");
    const toneIndex = prompt.indexOf("TONE");
    const examplesIndex = prompt.indexOf("EXAMPLES");
    const taskIndex = prompt.indexOf("TASK_BLOCK");
    expect(engineIndex).toBeLessThan(toneIndex);
    expect(toneIndex).toBeLessThan(examplesIndex);
    expect(examplesIndex).toBeLessThan(taskIndex);
  });
});
