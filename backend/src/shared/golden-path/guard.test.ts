import { describe, expect, it } from "vitest";

import { matchGuardGoldenPath } from "./guard";

describe("matchGuardGoldenPath", () => {
  it("demo 第二幕的草稿文字完全相符時命中，spans 索引對得上草稿原文", () => {
    const draft = "我們的品質跟別人不一樣，你可以去比較看看。";
    const match = matchGuardGoldenPath(draft);
    expect(match).toBeDefined();
    expect(match?.type).toBe("defensive");
    for (const span of match!.spans) {
      expect(draft.slice(span.start, span.end).length).toBeGreaterThan(0);
    }
    expect(draft.slice(match!.spans[0].start, match!.spans[0].end)).toBe("跟別人不一樣");
    expect(draft.slice(match!.spans[1].start, match!.spans[1].end)).toBe("你可以去比較看看");
  });

  it("草稿不完全相符就不命中", () => {
    expect(matchGuardGoldenPath("我們的品質跟別人不一樣")).toBeUndefined();
  });

  it("正規化比對：頭尾夾帶空白仍命中，spans 位移回原始 draft 的索引", () => {
    const draft = "  我們的品質跟別人不一樣，你可以去比較看看。  ";
    const match = matchGuardGoldenPath(draft);
    expect(match).toBeDefined();
    expect(match?.type).toBe("defensive");
    expect(draft.slice(match!.spans[0].start, match!.spans[0].end)).toBe("跟別人不一樣");
    expect(draft.slice(match!.spans[1].start, match!.spans[1].end)).toBe("你可以去比較看看");
  });

  it("正規化比對：全形／半形標點視為相同", () => {
    const draft = "我們的品質跟別人不一樣,你可以去比較看看.";
    const match = matchGuardGoldenPath(draft);
    expect(match).toBeDefined();
    expect(match?.type).toBe("defensive");
  });
});
