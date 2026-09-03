import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import { describe, expect, it, vi } from "vitest";

import type { Fact, KnowledgeReader } from "@/shared/knowledge";

import { createTestApp } from "@/lib/create-app";
import { loadContacts, loadFacts, staticKnowledgeReader } from "@/shared/knowledge";
import { formatTodayLine, loadPromptLayers } from "@/shared/prompts";

import { createAnalyzeServices } from "../services";
import { createAnalyzeRouter } from "./index";

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

function buildClient(model: LanguageModel, customKnowledge: KnowledgeReader = knowledge) {
  const services = createAnalyzeServices({ model, knowledge: customKnowledge, promptLayers });
  const router = createAnalyzeRouter(services);
  return testClient(createTestApp(router));
}

function getSystemPromptFrom(model: MockLanguageModelV4) {
  const call = model.doGenerateCalls.at(-1);
  const systemMessage = call?.prompt.find(message => message.role === "system");
  if (!systemMessage || systemMessage.role !== "system")
    throw new Error("system message 沒被送進模型");
  return systemMessage.content;
}

const TINY_SCREENSHOT_BASE64 = "aGVsbG8tc2NyZWVuc2hvdA=="; // "hello-screenshot"，測試用假圖片內容

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
        sources: ["quote-anchor-standard", "not-a-real-id"],
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
    expect(json.sources).toEqual([{ id: "quote-anchor-standard", label: "代操服務標準報價" }]);
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

describe("post /analyze — 截圖模式", () => {
  function screenshotResult(json: unknown) {
    return textResult(json);
  }

  it("回 200，且 image part 確實出現在送給模型的 messages 裡", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => screenshotResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: [],
        conversationText: "them: 你好",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        screenshot: TINY_SCREENSHOT_BASE64,
        screenshotMimeType: "image/png",
        tone: "concise",
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    await response.json();

    const call = model.doGenerateCalls.at(-1);
    const userMessage = call?.prompt.find(message => message.role === "user");
    if (!userMessage || userMessage.role !== "user" || typeof userMessage.content === "string") {
      throw new Error("user message 沒有帶圖片內容");
    }
    const filePart = userMessage.content.find(part => part.type === "file");
    expect(filePart).toBeDefined();
    if (!filePart || filePart.type !== "file")
      throw new Error("沒有找到 file content part");
    expect(filePart.mediaType).toContain("image");
    // MockLanguageModelV4 收到的最終 provider prompt 把 file data 包成 { type: "data", data }
    expect(filePart.data).toMatchObject({ type: "data" });
  });

  it("data URL 形式的截圖（data:image/jpeg;base64,...）也能正確解析出 mediaType", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => screenshotResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到",
        naiveReply: "收到",
        sources: [],
        conversationText: "",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: {
        screenshot: `data:image/jpeg;base64,${TINY_SCREENSHOT_BASE64}`,
        tone: "empathy",
      },
    });

    expect(response.status).toBe(200);
    const call = model.doGenerateCalls.at(-1);
    const userMessage = call?.prompt.find(message => message.role === "user");
    if (!userMessage || userMessage.role !== "user" || typeof userMessage.content === "string") {
      throw new Error("user message 沒有帶圖片內容");
    }
    const filePart = userMessage.content.find(part => part.type === "file");
    if (!filePart || filePart.type !== "file")
      throw new Error("沒有找到 file content part");
    expect(filePart.mediaType).toBe("image/jpeg");
  });

  it("screenshotMimeType 是空字串（欄位存在但沒填值）：驗證階段就擋下（422），不會呼叫模型", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型：空字串 mimeType 應該在 schema 驗證就被擋下");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.analyze.$post({
      json: {
        screenshot: TINY_SCREENSHOT_BASE64,
        screenshotMimeType: "",
        tone: "concise",
      },
    });

    expect(response.status).toBe(422);
  });

  it("screenshot 是 data: 開頭但格式不符（例如帶了 DATA_URL_PATTERN 沒預期到的參數）：回 400，不會呼叫模型", async () => {
    const throwingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型：無法解析的 data URL 應該在送進模型前就被拒絕");
      },
    });
    const client = buildClient(throwingModel);

    const response = await client.analyze.$post({
      json: {
        // 帶了 `;name=` 參數，DATA_URL_PATTERN 只接受 `;charset=`，故意不 match。
        screenshot: `data:image/png;name=shot.png;base64,${TINY_SCREENSHOT_BASE64}`,
        tone: "concise",
      },
    });

    expect(response.status).toBe(400);
    if (response.status !== 400)
      return;
    const json = await response.json();
    expect(json.message).toContain("data URL");
  });

  it("三種 tone 各自載入不同的語氣層，system prompt 內容有差異", async () => {
    function buildCapturingModel() {
      return new MockLanguageModelV4({
        doGenerate: async () => screenshotResult({
          risk: "safe",
          riskReason: "一般往來",
          reply: "收到，我看一下——晚點回您。",
          naiveReply: "收到",
          sources: [],
          conversationText: "them: 你好",
        }),
      });
    }

    async function systemPromptForTone(tone: "empathy" | "concise" | "affirmative") {
      const model = buildCapturingModel();
      const client = buildClient(model);
      await client.analyze.$post({
        json: { screenshot: TINY_SCREENSHOT_BASE64, tone },
      });
      return getSystemPromptFrom(model);
    }

    const empathyPrompt = await systemPromptForTone("empathy");
    const concisePrompt = await systemPromptForTone("concise");
    const affirmativePrompt = await systemPromptForTone("affirmative");

    expect(empathyPrompt).not.toBe(concisePrompt);
    expect(concisePrompt).not.toBe(affirmativePrompt);
    expect(empathyPrompt).not.toBe(affirmativePrompt);
    // 各自帶有自己語氣檔獨有的內容，不是三份都退回同一份 Zeno 預設
    expect(empathyPrompt).toContain("先跟你說聲抱歉");
    expect(concisePrompt).toContain("目標 1 句，最多 2 句");
    expect(affirmativePrompt).toContain("肯定句、少用疑問句或模糊詞");
  });

  it("知識庫全塞：facts 全部送進 prompt，sources 正確反映實際餵給模型的事實", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => screenshotResult({
        risk: "sensitive",
        riskReason: "在問報價",
        reply: "我確認一下報價，稍後回您。",
        naiveReply: "報價單附件給你",
        sources: ["proj-a-status", "not-a-real-id"],
        conversationText: "them: 報價大概多少？",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: TINY_SCREENSHOT_BASE64, tone: "concise" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    // 全塞策略：所有 17 筆事實（量小、不截斷）都要出現在 prompt 裡，不是關鍵字粗篩後的子集
    const systemPrompt = getSystemPromptFrom(model);
    for (const fact of loadFacts()) {
      expect(systemPrompt).toContain(`id: ${fact.id}`);
    }
    // 幻覺 id 被濾掉，internal 的 quote-floor-internal 沒被要求也不在
    expect(json.sources).toEqual([{ id: "proj-a-status", label: "A 案進度" }]);
  });

  it("知識庫超過 token 上限時會截斷，只留優先序前段的事實", async () => {
    const bigContent = "很長的內容需要佔用大量字數".repeat(200); // 一筆就吃掉大半預算
    const manyFacts: Fact[] = Array.from({ length: 10 }, (_, i) => ({
      id: `big-fact-${i}`,
      label: `大事實 ${i}`,
      tags: [],
      content: bigContent,
      updatedAt: "2026-09-01",
      volatility: i === 0 ? "high" : "low",
    }));
    const customKnowledge = staticKnowledgeReader(manyFacts, []);

    const model = new MockLanguageModelV4({
      doGenerate: async () => screenshotResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到",
        naiveReply: "收到",
        sources: [],
        conversationText: "",
      }),
    });
    const client = buildClient(model, customKnowledge);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await client.analyze.$post({
      json: { screenshot: TINY_SCREENSHOT_BASE64, tone: "concise" },
    });
    expect(response.status).toBe(200);

    const systemPrompt = getSystemPromptFrom(model);
    // volatility high 的第 0 筆優先塞入；資料量遠超預算，不可能 10 筆全進去
    expect(systemPrompt).toContain("id: big-fact-0");
    expect(systemPrompt).not.toContain("id: big-fact-9");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("截斷"));
    warnSpy.mockRestore();
  });

  it("截圖模式不觸發 golden path——即使讀出的 conversationText 與劇本逐字相同，仍然是 LLM 產出的內容", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => screenshotResult({
        risk: "pressure",
        riskReason: "測試用",
        reply: "這是 LLM 自己產出的回覆，不是 golden path 快取",
        naiveReply: "收到",
        sources: [],
        conversationText: "them: 這個進度到底怎麼樣了？下午要跟客戶開會。",
      }),
    });
    const client = buildClient(model);

    const response = await client.analyze.$post({
      json: { screenshot: TINY_SCREENSHOT_BASE64, tone: "concise" },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.reply).toBe("這是 LLM 自己產出的回覆，不是 golden path 快取");
    expect(model.doGenerateCalls.length).toBeGreaterThan(0);
  });
});

describe("post /analyze — 截圖過大", () => {
  it("截圖 base64 超過大小上限回 413", async () => {
    const client = buildClient(new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("不該呼叫模型");
      },
    }));

    const oversizedScreenshot = "A".repeat(15 * 1024 * 1024);
    const body = JSON.stringify({ screenshot: oversizedScreenshot, tone: "concise" });

    const response = await client.analyze.$post(
      { json: { screenshot: oversizedScreenshot, tone: "concise" } },
      { headers: { "content-length": String(new TextEncoder().encode(body).length) } },
    );

    expect(response.status).toBe(413);
  });
});

describe("system prompt 組裝規則（prompts/README-組裝說明.md「兩個引擎的通用組裝規則」）", () => {
  function buildCapturingModel() {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: [],
      }),
    });
    return model;
  }

  const getSystemPrompt = getSystemPromptFrom;

  it("規則 1：〈本次任務〉開頭注入今天日期", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "這週來得及嗎？", ts: "2026-09-06T09:12:00Z" }],
      },
    });

    expect(getSystemPrompt(model)).toContain(formatTodayLine());
  });

  it("規則 2：查無 contactId 時對象段落 fallback 為「未知（無檔案）」", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "你好", ts: "2026-09-06T09:12:00Z" }],
        contactId: "not-exist",
      },
    });

    expect(getSystemPrompt(model)).toContain("對象：未知（無檔案）");
  });

  it("規則 3：usage 為 internal 的事實會進 prompt 但標註不得寫入回覆", async () => {
    const model = buildCapturingModel();
    const client = buildClient(model);

    await client.analyze.$post({
      json: {
        conversation: [{ speaker: "them", text: "報價大概多少？", ts: "2026-09-06T09:12:00Z" }],
      },
    });

    const systemPrompt = getSystemPrompt(model);
    expect(systemPrompt).toContain("id: quote-floor-internal");
    expect(systemPrompt).toContain("（內部參考，不得寫入回覆）");
  });
});
