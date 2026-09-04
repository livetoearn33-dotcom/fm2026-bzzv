import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import { loadContacts, loadFacts, staticKnowledgeReader } from "@/shared/knowledge";
import { formatTodayLine, loadPromptLayers } from "@/shared/prompts";

import { createGuardServices } from "../services";
import { createGuardRouter } from "./index";

const knowledge = staticKnowledgeReader(loadFacts(), loadContacts());
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

function buildClient(model: LanguageModel, mockOnLlmError = false) {
  const services = createGuardServices({ model, knowledge, promptLayers, mockOnLlmError });
  const router = createGuardRouter(services);
  return testClient(createTestApp(router));
}

describe("post /guard", () => {
  it("golden path 命中時直接回準備好的結果，完全不呼叫 LLM", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("golden path 不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.guard.$post({
      json: {
        draft: "我們的品質跟別人不一樣，你可以去比較看看。",
        conversation: [{ speaker: "them", text: "這個價格比別家貴很多耶。" }],
        contactId: "client-wang",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.flagged).toBe(true);
    expect(json.type).toBe("defensive");
    expect(json.spans).toHaveLength(2);
  });

  it("模型判 flagged 時直接採用 LLM 的判定", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        flagged: true,
        type: "blame",
        reason: "他讀起來會像被踢皮球",
        spans: [{ start: 0, end: 5, label: "推卸" }],
        suggestion: "我這邊補寄一次給您。",
      }),
    });
    const client = buildClient(model);

    const response = await client.guard.$post({
      json: {
        draft: "那個要問你們窗口。",
        conversation: [{ speaker: "them", text: "上次的檔案怎麼還沒收到？" }],
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.flagged).toBe(true);
    expect(json.type).toBe("blame");
    expect(json.suggestion).toBe("我這邊補寄一次給您。");
  });

  it("模型判 false 但本地驚嘆號密度規則命中時仍 flagged", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({ flagged: false }),
    });
    const client = buildClient(model);

    const draft = "不然你想怎樣！！";
    const response = await client.guard.$post({
      json: { draft, conversation: [] },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.flagged).toBe(true);
    expect(json.type).toBe("heat");
    expect(json.spans.length).toBeGreaterThan(0);
    expect(json.suggestion).toBeTruthy();
  });

  it("兩者都沒中時 flagged: false，spans 空陣列", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({ flagged: false }),
    });
    const client = buildClient(model);

    const response = await client.guard.$post({
      json: { draft: "明天排不進來，最快下週三。", conversation: [] },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json).toEqual({
      flagged: false,
      type: null,
      reason: "",
      spans: [],
      suggestion: null,
    });
  });

  it("contactId 找不到時仍可檢查草稿", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({ flagged: false }),
    });
    const client = buildClient(model);

    const response = await client.guard.$post({
      json: { draft: "沒問題，我確認一下。", conversation: [], contactId: "not-exist" },
    });

    expect(response.status).toBe(200);
  });

  it("呼叫 LLM 失敗（重試一次仍失敗）回 502", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network down");
      },
    });
    const client = buildClient(model);

    const response = await client.guard.$post({
      json: { draft: "沒問題，我確認一下。", conversation: [] },
    });

    expect(response.status).toBe(502);
  });

  it("mockOnLlmError 開啟時：draft 超過 15 字回警告＋原因＋改善建議；15 字內回 flagged:false", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network down");
      },
    });
    const client = buildClient(model, true);

    const longDraft = await client.guard.$post({
      json: { draft: "這件事情我覺得我們應該再多討論幾次比較好，不然很難收尾", conversation: [] },
    });
    expect(longDraft.status).toBe(200);
    if (longDraft.status !== 200)
      return;
    const flagged = await longDraft.json();
    expect(flagged.flagged).toBe(true);
    expect(flagged.reason).toContain("示範資料");
    expect(flagged.suggestion).not.toBeNull();

    const shortDraft = await client.guard.$post({
      json: { draft: "好，我確認一下。", conversation: [] },
    });
    expect(shortDraft.status).toBe(200);
    if (shortDraft.status !== 200)
      return;
    expect((await shortDraft.json()).flagged).toBe(false);
  });
});

describe("system prompt 組裝規則（prompts/README-組裝說明.md「兩個引擎的通用組裝規則」）", () => {
  function buildCapturingModel() {
    return new MockLanguageModelV4({
      doGenerate: async () => textResult({ flagged: false }),
    });
  }

  function getSystemPrompt(model: MockLanguageModelV4) {
    const call = model.doGenerateCalls.at(-1);
    const systemMessage = call?.prompt.find(message => message.role === "system");
    if (!systemMessage || systemMessage.role !== "system")
      throw new Error("system message 沒被送進模型");
    return systemMessage.content;
  }

  it("規則 1：〈本次任務〉開頭注入今天日期", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.guard.$post({
      json: { draft: "這週來得及送出嗎，我再確認一下。", conversation: [] },
    });

    expect(getSystemPrompt(model)).toContain(formatTodayLine());
  });

  it("規則 2：查無 contactId 時對象段落 fallback 為「未知（無檔案）」", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.guard.$post({
      json: { draft: "沒問題，我確認一下。", conversation: [], contactId: "not-exist" },
    });

    expect(getSystemPrompt(model)).toContain("對象：未知（無檔案）");
  });
});
