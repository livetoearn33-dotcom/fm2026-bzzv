import { describe, expect, it } from "vitest";

import { computeSafeCard } from "./safe-card";

describe("computeSafeCard", () => {
  it("對進度催促類訊息回進度安全牌（demo 第一幕的訊息）", () => {
    const card = computeSafeCard([
      { speaker: "them", text: "這個進度到底怎麼樣了？下午要跟客戶開會。" },
    ]);
    expect(card).toBe("收到，我確認一下進度");
  });

  it("對報價／價格類訊息回報價安全牌", () => {
    const card = computeSafeCard([
      { speaker: "them", text: "這個價格比別家貴很多耶。" },
    ]);
    expect(card).toBe("我確認一下報價，稍後回您");
  });

  it("對交期類訊息回時間安全牌", () => {
    const card = computeSafeCard([
      { speaker: "them", text: "什麼時候可以出貨？" },
    ]);
    expect(card).toBe("我確認時間後回您");
  });

  it("落不進任何規則就回預設安全牌", () => {
    const card = computeSafeCard([
      { speaker: "them", text: "你們基礎方案是包含哪些？" },
    ]);
    expect(card).toBe("收到，我看一下");
  });

  it("只看對方最後一則訊息，不受自己說過的話干擾", () => {
    const card = computeSafeCard([
      { speaker: "them", text: "這個進度到底怎麼樣了？" },
      { speaker: "me", text: "價格我再確認一下" },
      { speaker: "them", text: "明天有空嗎？" },
    ]);
    expect(card).toBe("收到，我看一下");
  });

  it("空對話回預設安全牌", () => {
    expect(computeSafeCard([])).toBe("收到，我看一下");
  });
});
