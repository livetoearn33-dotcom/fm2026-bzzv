import { describe, expect, it } from "vitest";

import { matchPersonaGoldenPath } from "./persona";

const ACT1_REPLY = "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。";

describe("matchPersonaGoldenPath", () => {
  it("demo 劇本第一幕的回覆＋persona=zhuge 完全相符時命中，回準備好的諸葛亮版回覆", () => {
    const match = matchPersonaGoldenPath("zhuge", ACT1_REPLY);
    expect(match).toBeDefined();
    expect(match?.reply).toBe(
      "主公息怒。亮已探得軍情：合約仍候客戶回簽，癥結在彼不在我，已遣人催之。今晚八時，完整戰報必至——若誤期，甘受軍法。",
    );
  });

  it("正規化比對：頭尾夾帶空白仍命中", () => {
    const match = matchPersonaGoldenPath("zhuge", `  ${ACT1_REPLY}  `);
    expect(match).toBeDefined();
  });

  it("回覆文字不完全相符就不命中", () => {
    expect(matchPersonaGoldenPath("zhuge", "收到，我確認一下進度")).toBeUndefined();
  });

  it("persona 不是 zhuge 就不命中（目前只快取上台演的那個 persona）", () => {
    expect(matchPersonaGoldenPath("ceo", ACT1_REPLY)).toBeUndefined();
  });
});
