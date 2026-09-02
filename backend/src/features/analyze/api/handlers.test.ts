import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import { loadKnowledgeStore } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

import { createAnalyzeServices } from "../services";
import { createAnalyzeRouter } from "./index";

const knowledge = loadKnowledgeStore();
const promptLayers = loadPromptLayers();

function textResult(json: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    },
    warnings: [],
  };
}

function buildClient(model: LanguageModel) {
  const services = createAnalyzeServices({ model, knowledge, promptLayers });
  const router = createAnalyzeRouter(services);
  return testClient(createTestApp(router));
}

describe("post /analyze", () => {
  it("驗證 request body（conversation 為必填）", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);
    // @ts-expect-error 刻意送錯的 body，測驗證
    const response = await client.analyze.$post({ json: { contactId: "boss-lin" } });
    expect(response.status).toBe(422);
  });

  it("golden path 命中時直接回準備好的結果，完全不呼叫 LLM", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("golden path 不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.analyze.$post({
      json: {
        conversation: [
          { speaker: "them", text: "這個進度到底怎麼樣了？下午要跟客戶開會。", ts: "2026-09-06T09:12:00Z" },
        ],
        contactId: "boss-lin",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.risk).toBe("pressure");
    expect(json.safeCard).toBe("收到，我確認一下進度");
    expect(json.reply).toContain("今晚 8 點前補完整版給您確認");
    expect(json.naiveReply).toBe("收到");
    expect(json.sources).toEqual([{ id: "proj-a-status", label: "A 案進度" }]);
    expect(typeof json.latencyMs).toBe("number");
  });

  it("一般訊息會呼叫 LLM，並把 fact id 映射回 {id,label}", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        risk: "sensitive",
        riskReason: "他在比價，要的是台階",
        reply: "我確認一下報價，稍後回您——基礎方案含企劃、拍攝、剪輯三項。",
        naiveReply: "報價單附件給你",
        sources: ["quote-standard-2026", "not-a-real-id"],
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        conversation: [
          { speaker: "them", text: "報價大概多少？", ts: "2026-09-06T09:12:00Z" },
        ],
        contactId: "client-wang",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.safeCard).toBe("我確認一下報價，稍後回您");
    expect(json.reply.startsWith(json.safeCard)).toBe(true);
    // 幻覺 id 被濾掉，只留真的被塞進 context 的 fact
    expect(json.sources).toEqual([{ id: "quote-standard-2026", label: "2026 標準報價" }]);
  });

  it("reply 不以 safeCard 開頭時重打一次，仍不符就退回 safeCard 當 reply", async () => {
    const badReply = textResult({
      risk: "safe",
      riskReason: "測試用",
      reply: "完全不是安全牌開頭的句子",
      naiveReply: "收到",
      sources: [],
    });
    const model = new MockLanguageModelV4({
      doGenerate: [badReply, badReply],
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "報價大概多少？", ts: "2026-09-06T09:12:00Z" }],
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toBe(json.safeCard);
  });

  it("contactId 找不到時仍可分析，只是沒有對象資料", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: [],
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "你好", ts: "2026-09-06T09:12:00Z" }],
        contactId: "not-exist",
      },
    });

    expect(response.status).toBe(200);
  });

  it("呼叫 LLM 失敗（重試一次仍失敗）回 502，不靜默回假資料", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network down");
      },
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "報價大概多少？", ts: "2026-09-06T09:12:00Z" }],
      },
    });

    expect(response.status).toBe(502);
    if (response.status !== 502)
      return;
    const json = await response.json();
    expect(json.message).toContain("network down");
  });
});
