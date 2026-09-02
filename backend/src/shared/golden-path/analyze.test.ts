import { describe, expect, it } from "vitest";

import { matchAnalyzeGoldenPath } from "./analyze";

describe("matchAnalyzeGoldenPath", () => {
  it("demo 第一幕的訊息文字完全相符時命中", () => {
    const match = matchAnalyzeGoldenPath([
      { speaker: "them", text: "這個進度到底怎麼樣了？下午要跟客戶開會。" },
    ]);
    expect(match).toBeDefined();
    expect(match?.risk).toBe("pressure");
    expect(match?.sourceIds).toEqual(["proj-a-status"]);
  });

  it("文字不完全相符就不命中（不做模糊比對）", () => {
    const match = matchAnalyzeGoldenPath([
      { speaker: "them", text: "這個進度到底怎麼樣了" },
    ]);
    expect(match).toBeUndefined();
  });

  it("看的是最後一則對方訊息，不是第一則", () => {
    const match = matchAnalyzeGoldenPath([
      { speaker: "them", text: "這個進度到底怎麼樣了？下午要跟客戶開會。" },
      { speaker: "me", text: "收到" },
      { speaker: "them", text: "還有另一件事" },
    ]);
    expect(match).toBeUndefined();
  });
});
