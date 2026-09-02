import { describe, expect, it } from "vitest";

import type { Contact } from "@/shared/knowledge";

import { buildGuardSystemPrompt, buildGuardTaskBlock } from "./build-prompt";

const contact: Contact = {
  id: "client-wang",
  name: "王先生",
  role: "客戶",
  tone: "禮貌、給選項",
  notes: "價格敏感",
  recentTopics: ["報價"],
};

describe("buildGuardTaskBlock", () => {
  it("只取對話最後 3 則，並帶出草稿原文", () => {
    const block = buildGuardTaskBlock({
      contact,
      conversation: [
        { speaker: "them", text: "第一則" },
        { speaker: "me", text: "第二則" },
        { speaker: "them", text: "第三則" },
        { speaker: "them", text: "第四則" },
      ],
      draft: "我們的品質跟別人不一樣。",
    });

    expect(block).not.toContain("第一則");
    expect(block).toContain("第二則");
    expect(block).toContain("第三則");
    expect(block).toContain("第四則");
    expect(block).toContain("〈草稿〉\n我們的品質跟別人不一樣。");
  });

  it("沒有對話時寫「（無對話紀錄）」", () => {
    const block = buildGuardTaskBlock({ contact: undefined, conversation: [], draft: "草稿" });
    expect(block).toContain("（無對話紀錄）");
    expect(block).toContain("對象：（無對象資料）");
  });
});

describe("buildGuardSystemPrompt", () => {
  it("依序串接引擎、語氣、本次任務三層（比 analyze 少一層）", () => {
    const prompt = buildGuardSystemPrompt(
      { analyzeEngine: "X", guardEngine: "ENGINE", tone: "TONE", examples: "X" },
      "TASK_BLOCK",
    );
    expect(prompt.indexOf("ENGINE")).toBeLessThan(prompt.indexOf("TONE"));
    expect(prompt.indexOf("TONE")).toBeLessThan(prompt.indexOf("TASK_BLOCK"));
  });
});
