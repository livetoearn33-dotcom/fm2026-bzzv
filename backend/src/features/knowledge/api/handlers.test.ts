import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAnalyzeRouter } from "@/features/analyze/api";
import { createAnalyzeServices } from "@/features/analyze/services";
import { createTestApp } from "@/lib/create-app";
import { LiveKnowledgeStore, resolveDataDir } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

import { createKnowledgeRouter } from "./index";

/**
 * 每個測試都在 os.tmpdir() 下複製一份真實 data/*.json 當作 DATA_DIR，
 * 絕不對 repo 的 data/ 目錄讀寫；afterEach 清掉暫存目錄。
 */
let tmpDir: string;
let store: LiveKnowledgeStore;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fm2026-knowledge-test-"));
  const sourceDir = resolveDataDir();
  fs.copyFileSync(path.join(sourceDir, "facts.json"), path.join(tmpDir, "facts.json"));
  fs.copyFileSync(path.join(sourceDir, "contacts.json"), path.join(tmpDir, "contacts.json"));
  store = new LiveKnowledgeStore(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function buildKnowledgeClient() {
  return testClient(createTestApp(createKnowledgeRouter(store)));
}

describe("get /contacts", () => {
  it("列出全部對象檔案，過濾 _TODO 前綴", async () => {
    const client = buildKnowledgeClient();
    const response = await client.contacts.$get();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.some(contact => contact.id.startsWith("_TODO"))).toBe(false);
    expect(json.map(contact => contact.id)).toContain("boss-lin");
  });
});

describe("get /facts", () => {
  it("列出全部事實，過濾 _TODO 前綴", async () => {
    const client = buildKnowledgeClient();
    const response = await client.facts.$get();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.some(fact => fact.id.startsWith("_TODO"))).toBe(false);
    expect(json.map(fact => fact.id)).toContain("proj-a-status");
  });
});

describe("put /contacts/{id}", () => {
  it("新增一筆不存在的 id", async () => {
    const client = buildKnowledgeClient();
    const response = await client.contacts[":id"].$put({
      param: { id: "new-contact" },
      json: {
        name: "測試對象",
        role: "客戶",
        tone: "客氣",
        notes: "測試用",
        recentTopics: ["測試"],
      },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({
      id: "new-contact",
      name: "測試對象",
      role: "客戶",
      tone: "客氣",
      notes: "測試用",
      recentTopics: ["測試"],
    });

    const listResponse = await client.contacts.$get();
    const list = await listResponse.json();
    expect(list.map(contact => contact.id)).toContain("new-contact");
  });

  it("更新既有 id 會覆蓋整筆內容", async () => {
    const client = buildKnowledgeClient();
    const response = await client.contacts[":id"].$put({
      param: { id: "boss-lin" },
      json: {
        name: "林經理（更新）",
        role: "主管",
        tone: "更直接",
        notes: "更新後備註",
        recentTopics: ["新主題"],
      },
    });
    expect(response.status).toBe(200);

    const listResponse = await client.contacts.$get();
    const list = await listResponse.json();
    const updated = list.find(contact => contact.id === "boss-lin");
    expect(updated?.name).toBe("林經理（更新）");
    expect(list).toHaveLength(2);
  });

  it("id 為 _TODO 前綴回 400", async () => {
    const client = buildKnowledgeClient();
    const response = await client.contacts[":id"].$put({
      param: { id: "_TODO-contact-03" },
      json: {
        name: "不該成功",
        role: "客戶",
        tone: "客氣",
        notes: "",
        recentTopics: [],
      },
    });
    expect(response.status).toBe(400);
  });

  it("寫檔格式維持 2 空格縮排 JSON 加結尾換行", async () => {
    const client = buildKnowledgeClient();
    await client.contacts[":id"].$put({
      param: { id: "format-check" },
      json: { name: "格式檢查", role: "", tone: "", notes: "", recentTopics: [] },
    });
    const raw = fs.readFileSync(path.join(tmpDir, "contacts.json"), "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("  {\n");
    expect(JSON.parse(raw)).toBeInstanceOf(Array);
  });
});

describe("delete /contacts/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildKnowledgeClient();
    const response = await client.contacts[":id"].$delete({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("刪除既有 id 後 GET 列表不再出現", async () => {
    const client = buildKnowledgeClient();
    const deleteResponse = await client.contacts[":id"].$delete({ param: { id: "boss-lin" } });
    expect(deleteResponse.status).toBe(204);

    const listResponse = await client.contacts.$get();
    const list = await listResponse.json();
    expect(list.map(contact => contact.id)).not.toContain("boss-lin");
  });
});

describe("put /facts/{id}", () => {
  it("新增一筆時省略 updatedAt，後端補今天日期", async () => {
    const client = buildKnowledgeClient();
    const response = await client.facts[":id"].$put({
      param: { id: "new-fact" },
      json: {
        label: "新事實",
        tags: ["新標籤"],
        content: "新內容",
        volatility: "low",
      },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    const today = new Date().toISOString().slice(0, 10);
    expect(json.updatedAt).toBe(today);
    expect(json.id).toBe("new-fact");
  });

  it("更新既有 id 會覆蓋整筆內容", async () => {
    const client = buildKnowledgeClient();
    const response = await client.facts[":id"].$put({
      param: { id: "proj-a-status" },
      json: {
        label: "A 案進度（更新）",
        tags: ["進度"],
        content: "已回簽",
        updatedAt: "2026-09-10",
        volatility: "low",
      },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.content).toBe("已回簽");
    expect(json.updatedAt).toBe("2026-09-10");
  });

  it("id 為 _TODO 前綴回 400", async () => {
    const client = buildKnowledgeClient();
    const response = await client.facts[":id"].$put({
      param: { id: "_TODO-fact-06" },
      json: { label: "不該成功", tags: [], content: "", volatility: "low" },
    });
    expect(response.status).toBe(400);
  });
});

describe("delete /facts/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildKnowledgeClient();
    const response = await client.facts[":id"].$delete({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("刪除既有 id 後 GET 列表不再出現", async () => {
    const client = buildKnowledgeClient();
    const deleteResponse = await client.facts[":id"].$delete({ param: { id: "proj-a-status" } });
    expect(deleteResponse.status).toBe(204);

    const listResponse = await client.facts.$get();
    const list = await listResponse.json();
    expect(list.map(fact => fact.id)).not.toContain("proj-a-status");
  });
});

describe("put 後 /analyze 立刻看到新 fact（同一個 store 參考，不是啟動時快照）", () => {
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

  function buildAnalyzeClient(model: LanguageModel) {
    const promptLayers = loadPromptLayers();
    const services = createAnalyzeServices({ model, knowledge: store, promptLayers });
    return testClient(createTestApp(createAnalyzeRouter(services)));
  }

  it("pUT 新 fact 後，/analyze 的檢索與 sources 能看到它", async () => {
    const knowledgeClient = buildKnowledgeClient();
    const putResponse = await knowledgeClient.facts[":id"].$put({
      param: { id: "test-new-topic" },
      json: {
        label: "新測試事實",
        tags: ["testtopic"],
        content: "這是 PUT 之後才存在的測試事實內容。",
        volatility: "low",
      },
    });
    expect(putResponse.status).toBe(200);

    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        risk: "safe",
        riskReason: "一般往來",
        reply: "收到，我看一下——晚點回您。",
        naiveReply: "收到",
        sources: ["test-new-topic"],
      }),
    });
    const analyzeClient = buildAnalyzeClient(model);

    const response = await analyzeClient.analyze.$post({
      json: {
        conversation: [
          { speaker: "them", text: "關於 testtopic 的事，你有空聊聊嗎？", ts: "2026-09-06T09:12:00Z" },
        ],
      },
    });

    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.sources).toEqual([{ id: "test-new-topic", label: "新測試事實" }]);
  });
});
