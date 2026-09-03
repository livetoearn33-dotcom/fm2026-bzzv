import { describe, expect, it } from "vitest";

import { mergeGuardSignals } from "./merge-signals";

describe("mergeGuardSignals", () => {
  it("模型判 true 時以 LLM 結果為主", () => {
    const result = mergeGuardSignals(
      {
        flagged: true,
        type: "defensive",
        reason: "帶防禦語氣",
        spans: [{ start: 0, end: 3, label: "防禦" }],
        suggestion: "換個說法",
      },
      { flagged: false, spans: [] },
    );
    expect(result).toEqual({
      flagged: true,
      type: "defensive",
      reason: "帶防禦語氣",
      spans: [{ start: 0, end: 3, label: "防禦" }],
      suggestion: "換個說法",
    });
  });

  it("模型判 true 且本地也命中時合併 spans 並去重", () => {
    const result = mergeGuardSignals(
      {
        flagged: true,
        type: "heat",
        reason: "火氣出去了",
        spans: [{ start: 0, end: 3, label: "火氣" }],
        suggestion: "緩和語氣",
      },
      { flagged: true, spans: [{ start: 0, end: 3, label: "火氣" }, { start: 5, end: 6, label: "火氣" }] },
    );
    expect(result.spans).toHaveLength(2);
    expect(result.spans).toEqual(
      expect.arrayContaining([
        { start: 0, end: 3, label: "火氣" },
        { start: 5, end: 6, label: "火氣" },
      ]),
    );
  });

  it("模型判 false 但本地命中時仍 flagged，並使用本地生成的通用建議", () => {
    const result = mergeGuardSignals(
      { flagged: false },
      { flagged: true, spans: [{ start: 4, end: 5, label: "火氣" }] },
    );
    expect(result.flagged).toBe(true);
    expect(result.type).toBe("heat");
    expect(result.spans).toEqual([{ start: 4, end: 5, label: "火氣" }]);
    expect(result.suggestion).toBeTruthy();
  });

  it("兩者都沒中時 flagged: false，spans 空陣列，其餘欄位為 null／空字串", () => {
    const result = mergeGuardSignals(
      { flagged: false },
      { flagged: false, spans: [] },
    );
    expect(result).toEqual({
      flagged: false,
      type: null,
      reason: "",
      spans: [],
      suggestion: null,
    });
  });
});
