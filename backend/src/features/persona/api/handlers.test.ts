import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";

import { createPersonaServices } from "../services";
import { createPersonaRouter } from "./index";

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    },
    warnings: [],
  };
}

function buildClient(model: LanguageModel) {
  const services = createPersonaServices({ model });
  const router = createPersonaRouter(services);
  return testClient(createTestApp(router));
}

const ACT1_REPLY = "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。";

describe("post /persona", () => {
  it("golden path 命中時直接回準備好的諸葛亮版回覆，完全不呼叫 LLM", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("golden path 不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.persona.$post({
      json: {
        reply: ACT1_REPLY,
        conversation: [{ speaker: "them", text: "這個進度到底怎麼樣了？下午要跟客戶開會。" }],
        persona: "zhuge",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toBe(
      "主公勿憂。臣已探得軍情：合約仍候客戶端回簽，已遣人催之。今晚八時前，完整戰報必至。",
    );
  });

  it("一般回覆會呼叫 LLM，回傳改寫後的文字", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult("這點小事，本座已經處理好了。"),
    });
    const client = buildClient(model);

    const response = await client.persona.$post({
      json: {
        reply: "收到，我確認一下報價，稍後回您。",
        conversation: [],
        persona: "ceo",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toBe("這點小事，本座已經處理好了。");
  });

  it("未知 personaId 回 400，不呼叫 LLM", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("未知 persona 不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.persona.$post({
      json: {
        reply: "收到，我看一下。",
        conversation: [],
        persona: "not-a-real-persona",
      },
    });

    expect(response.status).toBe(400);
  });

  it("驗證 request body（reply、persona 為必填）", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);
    // @ts-expect-error 刻意送錯的 body，測驗證
    const response = await client.persona.$post({ json: { persona: "zhuge" } });
    expect(response.status).toBe(422);
  });

  it("呼叫 LLM 失敗（重試一次仍失敗）回 502", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network down");
      },
    });
    const client = buildClient(model);

    const response = await client.persona.$post({
      json: {
        reply: "收到，我看一下。",
        conversation: [],
        persona: "charmer",
      },
    });

    expect(response.status).toBe(502);
  });
});
