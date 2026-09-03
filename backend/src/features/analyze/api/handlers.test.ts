import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

import { createTestApp } from "@/lib/create-app";
import { loadKnowledgeStore } from "@/shared/knowledge";
import { formatTodayLine, loadPromptLayers } from "@/shared/prompts";

import { createAnalyzeServices } from "../services";
import { createAnalyzeRouter } from "./index";

const knowledge = loadKnowledgeStore();
const promptLayers = loadPromptLayers();

// 1x1 透明 PNG，測試用最小合法 image data URL
const SCREENSHOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const GOLDEN_CONVERSATION_TEXT = "them: 這個進度到底怎麼樣了？下午要跟客戶開會。";

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
  it("驗證 request body（screenshot 為必填、且要是 image data URL）", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);
    const response = await client.analyze.$post({ json: { contactId: "boss-lin" } as any });
    expect(response.status).toBe(422);
  });

  it("screenshot 不是合法 data URL 時 422", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);
    const response = await client.analyze.$post({ json: { screenshot: "not-a-data-url" } });
    expect(response.status).toBe(422);
  });

  it("讀圖後 conversationText 命中 golden path：覆蓋 risk/reply/naiveReply/sources，但模型仍被呼叫一次（讀圖本身沒有捷徑）", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: GOLDEN_CONVERSATION_TEXT,
        risk: "safe",
        riskReason: "模型自己的判斷（應該被golden覆蓋）",
        reply: "模型自己生成的回覆（應該被覆蓋）",
        naiveReply: "收到",
        sources: [],
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: SCREENSHOT, contactId: "boss-lin" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(model.doGenerateCalls.length).toBe(1);
    expect(json.conversationText).toBe(GOLDEN_CONVERSATION_TEXT);
    expect(json.risk).toBe("pressure");
    expect(json.reply).toContain("今晚 8 點前補完整版給您確認");
    expect(json.naiveReply).toBe("收到");
    expect(json.sources).toEqual([{ id: "proj-a-status", label: "A 案進度" }]);
    expect(typeof json.latencyMs).toBe("number");
  });

  it("一般畫面會呼叫 LLM，並把 fact id 映射回 {id,label}，幻覺 id 被濾掉", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: "them: 報價大概多少？",
        risk: "sensitive",
        riskReason: "他在比價，要的是台階",
        reply: "我確認一下報價，稍後回您——基礎方案含企劃、拍攝、剪輯三項。",
        naiveReply: "報價單附件給你",
        sources: ["quote-anchor-standard", "not-a-real-id"],
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: SCREENSHOT, contactId: "client-wang" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.conversationText).toBe("them: 報價大概多少？");
    expect(json.sources).toEqual([{ id: "quote-anchor-standard", label: "代操服務標準報價" }]);
  });

  it("模型判斷截圖上沒有對話（{error:\"no_conversation\"}）時回 422", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({ error: "no_conversation" }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({ json: { screenshot: SCREENSHOT } });

    expect(response.status).toBe(422);
    if (response.status !== 422)
      return;
    const json = await response.json();
    // 422 有兩種形狀（zod 驗證錯誤 vs AnalyzeNoConversationError 的 {message}），縮窄再斷言
    if (!("message" in json))
      throw new Error("預期是 AnalyzeNoConversationError 的 {message} 形狀");
    expect(json.message).toContain("讀不到對話");
  });

  it("contactId 找不到時仍可分析，只是沒有對象資料", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: "them: 你好",
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: [],
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: SCREENSHOT, contactId: "not-exist" },
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

    const response = await client.analyze.$post({ json: { screenshot: SCREENSHOT } });

    expect(response.status).toBe(502);
    if (response.status !== 502)
      return;
    const json = await response.json();
    expect(json.message).toContain("network down");
  });

  it("未知的 persona 回 400，不呼叫模型", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.analyze.$post({
      // @ts-expect-error 刻意送錯的 persona，測驗證
      json: { screenshot: SCREENSHOT, persona: "not-a-real-persona" },
    });

    // zod enum 驗證先擋下（不是我們自訂的 AnalyzePersonaNotFoundError 400 分支——
    // 那支只有在 persona 通過 enum 驗證、但角色卡檔案本身找不到時才會走到）
    expect(response.status).toBe(422);
  });

  it("persona=zhuge 命中 golden path 時：reply 換成角色版快取、plainReply 帶原版", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: GOLDEN_CONVERSATION_TEXT,
        risk: "safe",
        riskReason: "模型自己的判斷（應該被覆蓋）",
        reply: "模型自己生成的角色版（應該被覆蓋）",
        naiveReply: "收到",
        sources: [],
        plainReply: "模型自己生成的正常版（應該被覆蓋）",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: SCREENSHOT, contactId: "boss-lin", persona: "zhuge" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toContain("主公息怒");
    expect(json.plainReply).toContain("今晚 8 點前補完整版給您確認");
  });

  it("persona=ceo 命中 golden path 但沒有角色版快取時：不覆蓋，直接用 LLM 當次真的產出的結果", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: GOLDEN_CONVERSATION_TEXT,
        risk: "pressure",
        riskReason: "LLM 自己判斷的原因",
        reply: "LLM 自己生成的顧北辰版回覆",
        naiveReply: "收到",
        sources: [],
        plainReply: "LLM 自己生成的正常版",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: SCREENSHOT, contactId: "boss-lin", persona: "ceo" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toBe("LLM 自己生成的顧北辰版回覆");
    expect(json.plainReply).toBe("LLM 自己生成的正常版");
  });
});

describe("system prompt 組裝規則（prompts/README-組裝說明.md「兩個引擎的通用組裝規則」）", () => {
  function buildCapturingModel() {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        conversationText: "them: 哈囉",
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: [],
      }),
    });
    return model;
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

    await client.analyze.$post({ json: { screenshot: SCREENSHOT } });

    expect(getSystemPrompt(model)).toContain(formatTodayLine());
  });

  it("規則 2：查無 contactId 時對象段落 fallback 為「未知（無檔案）」", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({ json: { screenshot: SCREENSHOT, contactId: "not-exist" } });

    expect(getSystemPrompt(model)).toContain("對象：未知（無檔案）");
  });

  it("規則 3：usage 為 internal 的事實會進 prompt 但標註不得寫入回覆", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({ json: { screenshot: SCREENSHOT } });

    const systemPrompt = getSystemPrompt(model);
    expect(systemPrompt).toContain("id: quote-floor-internal");
    expect(systemPrompt).toContain("（內部參考，不得寫入回覆）");
  });

  it("截圖以 image content part 附上，不放進系統提示文字裡", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({ json: { screenshot: SCREENSHOT } });

    const call = model.doGenerateCalls.at(-1);
    const userMessage = call?.prompt.find(message => message.role === "user");
    expect(userMessage).toBeDefined();
    if (!userMessage || userMessage.role !== "user")
      throw new Error("user message 沒被送進模型");
    const hasFilePart = (userMessage.content as any[]).some(part => part.type === "file");
    expect(hasFilePart).toBe(true);
  });
});
