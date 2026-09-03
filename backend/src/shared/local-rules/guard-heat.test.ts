import { describe, expect, it } from "vitest";

import { detectHeatSignal } from "./guard-heat";

describe("detectHeatSignal", () => {
  it("兩個以上驚嘆號視為密度過高", () => {
    const result = detectHeatSignal("不然你想怎樣！！");
    expect(result.flagged).toBe(true);
    expect(result.spans).toHaveLength(2);
    expect(result.spans[0].label).toBe("火氣");
  });

  it("短句只出現一個驚嘆號也算密度高", () => {
    const result = detectHeatSignal("週五！");
    expect(result.flagged).toBe(true);
    expect(result.spans).toHaveLength(1);
  });

  it("長句只有一個驚嘆號不算密度過高", () => {
    const draft = "這個我們今天會確認完整的排程，明天一定給您答案，請放心！";
    expect(draft.length).toBeGreaterThan(15);
    const result = detectHeatSignal(draft);
    expect(result.flagged).toBe(false);
    expect(result.spans).toHaveLength(0);
  });

  it("沒有驚嘆號不觸發", () => {
    const result = detectHeatSignal("明天排不進來，最快下週三。");
    expect(result.flagged).toBe(false);
    expect(result.spans).toEqual([]);
  });

  it("spans 的字元索引對得上草稿原文", () => {
    const draft = "不然你想怎樣！！";
    const result = detectHeatSignal(draft);
    for (const span of result.spans) {
      expect(draft.slice(span.start, span.end)).toBe("！");
    }
  });
});
