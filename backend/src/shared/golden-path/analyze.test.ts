import { describe, expect, it } from "vitest";

import { matchAnalyzeGoldenPath } from "./analyze";

describe("matchAnalyzeGoldenPath", () => {
  it("demo 第一幕的 conversationText 完全相符時命中", () => {
    const match = matchAnalyzeGoldenPath("them: 這個進度到底怎麼樣了？下午要跟客戶開會。");
    expect(match).toBeDefined();
    expect(match?.risk).toBe("pressure");
    expect(match?.sourceIds).toEqual(["proj-a-status"]);
  });

  it("文字不完全相符就不命中（不做模糊比對）", () => {
    const match = matchAnalyzeGoldenPath("them: 這個進度到底怎麼樣了");
    expect(match).toBeUndefined();
  });

  it("正規化比對：頭尾夾帶空白、全形／半形標點統一後仍命中", () => {
    const match = matchAnalyzeGoldenPath("  them: 這個進度到底怎麼樣了?下午要跟客戶開會.  ");
    expect(match).toBeDefined();
    expect(match?.risk).toBe("pressure");
  });

  it("多行 conversationText（LLM 讀到多則訊息）不完全相符就不命中", () => {
    const match = matchAnalyzeGoldenPath(
      "them: 這個進度到底怎麼樣了？下午要跟客戶開會。\nme: 收到\nthem: 還有另一件事",
    );
    expect(match).toBeUndefined();
  });
});
