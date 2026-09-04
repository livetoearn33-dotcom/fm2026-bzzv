import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { testClient } from "hono/testing";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { TestDb } from "@/db/test-client";

import { createTestDb } from "@/db/test-client";
import { createTestApp } from "@/lib/create-app";
import { DbKnowledgeBaseStore, DbKnowledgeStore } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

import { createKnowledgeBaseServices } from "../services";
import { createKnowledgeBasesRouter } from "./index";

/**
 * 每個測試都用一份全新的 pglite（記憶體內 Postgres），套用真正的 migration SQL，
 * 不連真的 Postgres、不打真的 OpenAI（LLM 一律用 MockLanguageModelV4 注入）。
 */
let db: TestDb;
let store: DbKnowledgeStore;
let baseStore: DbKnowledgeBaseStore;

const fixturesDir = path.resolve(__dirname, "../fixtures");
const samplePdfBytes = fs.readFileSync(path.join(fixturesDir, "sample.pdf"));

beforeEach(async () => {
  db = await createTestDb();
  store = new DbKnowledgeStore(db);
  baseStore = new DbKnowledgeBaseStore(db);
});

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
  const promptLayers = loadPromptLayers();
  const services = createKnowledgeBaseServices({ model, bases: baseStore, knowledge: store, promptLayers, mockOnLlmError });
  return testClient(createTestApp(createKnowledgeBasesRouter(services)));
}

/** 每次 LLM 呼叫依序回傳一個結果（多檔上傳＝多次呼叫）。 */
function queuedModel(outputs: unknown[]) {
  const queue = [...outputs];
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error("mock LLM 呼叫次數超過預期");
      }
      return textResult(next);
    },
  });
}

function pdfFile(name = "報價單.pdf") {
  return new File([samplePdfBytes], name, { type: "application/pdf" });
}

const ITEM_A = { label: "Y 方案報價", content: "Y 方案 8 萬。", tags: ["報價"], volatility: "high" as const };
const ITEM_B = { label: "交期", content: "交期 45 天。", tags: ["交期"], volatility: "low" as const };

describe("post /knowledge-bases", () => {
  it("一次上傳多個 PDF：回單一 knowledgeBaseId，items 合併且 suggestedId 不重複，狀態 draft", async () => {
    const client = buildClient(queuedModel([
      { extracted: true, items: [ITEM_A] },
      { extracted: true, items: [ITEM_B] },
    ]));

    const response = await client["knowledge-bases"].$post({
      form: { files: [pdfFile("a.pdf"), pdfFile("b.pdf")], name: "宏碩 Q4 報價案" },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();

    expect(json.status).toBe("draft");
    expect(json.name).toBe("宏碩 Q4 報價案");
    expect(json.extracted).toBe(true);
    expect(json.files).toHaveLength(2);
    expect(json.files.every(file => file.status === "extracted")).toBe(true);
    expect(json.items).toHaveLength(2);
    const suggestedIds = json.items.map(item => item.suggestedId);
    expect(new Set(suggestedIds).size).toBe(2);

    const detail = await baseStore.getById(json.knowledgeBaseId);
    expect(detail?.status).toBe("draft");
    expect(detail?.fileCount).toBe(2);
  });

  it("internal 知識庫：草稿條目全部預填 usage internal，commit 傳 internal:false 也強制蓋成 internal", async () => {
    const client = buildClient(queuedModel([
      { extracted: true, items: [ITEM_A, { ...ITEM_B, usage: undefined }] },
    ]));

    const created = await client["knowledge-bases"].$post({
      form: { files: pdfFile(), name: "議價底線", internal: "true" },
    });
    expect(created.status).toBe(200);
    if (created.status !== 200)
      return;
    const createdJson = await created.json();
    expect(createdJson.internal).toBe(true);
    expect(createdJson.items.every(item => item.usage === "internal")).toBe(true);

    // 逐條傳 internal:false 嘗試反轉——應被知識庫層旗標蓋掉
    const commitResponse = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: createdJson.knowledgeBaseId },
      json: {
        items: createdJson.items.map(item => ({
          id: item.suggestedId,
          label: item.label,
          content: item.content,
          tags: item.tags,
          volatility: item.volatility,
          internal: false,
        })),
      },
    });
    expect(commitResponse.status).toBe(200);
    if (commitResponse.status !== 200)
      return;
    const committed = await commitResponse.json();
    expect(committed.facts.every(fact => fact.usage === "internal")).toBe(true);

    const listResponse = await client["knowledge-bases"].$get();
    expect(listResponse.status).toBe(200);
    if (listResponse.status !== 200)
      return;
    expect((await listResponse.json())[0].internal).toBe(true);
  });

  it("跳過壞檔繼續：一好一壞（txt）回 200，壞檔標 failed 帶 errorReason，好檔照抽", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));

    const response = await client["knowledge-bases"].$post({
      form: {
        files: [pdfFile("好檔.pdf"), new File(["hello"], "note.txt", { type: "text/plain" })],
      },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();

    expect(json.items).toHaveLength(1);
    const failed = json.files.find(file => file.fileName === "note.txt");
    expect(failed?.status).toBe("failed");
    expect(failed?.errorReason).toContain("只接受 PDF");
    expect(json.files.find(file => file.fileName === "好檔.pdf")?.status).toBe("extracted");
  });

  it("全部檔案都壞：整個 create 失敗（單一 txt 回 415），知識庫標 failed 留紀錄", async () => {
    const client = buildClient(queuedModel([]));

    const response = await client["knowledge-bases"].$post({
      form: { files: new File(["hello"], "note.txt", { type: "text/plain" }) },
    });
    expect(response.status).toBe(415);

    const list = await baseStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("failed");
  });

  it("mockOnLlmError 開啟時：LLM 失敗改回示範抽取條目（標「示範資料」），流程照走", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("network down");
      },
    });
    const client = buildClient(model, true);

    const response = await client["knowledge-bases"].$post({
      form: { files: pdfFile() },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.status).toBe("draft");
    expect(json.extracted).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);
    expect(json.items.every(item => item.tags.includes("示範資料"))).toBe(true);
    expect(json.files[0].status).toBe("extracted");
  });

  it("引擎判定所有檔案都抽不到事實：回 200、extracted:false 帶 reason", async () => {
    const client = buildClient(queuedModel([
      { extracted: false, reason: "這份文件我讀不到具體的數字或條件" },
    ]));

    const response = await client["knowledge-bases"].$post({
      form: { files: pdfFile("目錄頁.pdf") },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.extracted).toBe(false);
    expect(json.items).toEqual([]);
    expect(json.reason).toBe("這份文件我讀不到具體的數字或條件");
    expect(json.status).toBe("draft");
  });
});

describe("get /knowledge-bases", () => {
  it("列表不含 draft 全文，帶 files 與 fileCount", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));
    await client["knowledge-bases"].$post({ form: { files: pdfFile() } });

    const response = await client["knowledge-bases"].$get();
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json).toHaveLength(1);
    expect(json[0]).not.toHaveProperty("draft");
    expect(json[0].fileCount).toBe(1);
    expect(json[0].files[0].fileName).toBe("報價單.pdf");
  });
});

describe("get /knowledge-bases/{id}", () => {
  it("不存在（含非 uuid）回 404", async () => {
    const client = buildClient(queuedModel([]));
    const response = await client["knowledge-bases"][":id"].$get({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("回合併後的 draft（重開未 commit 知識庫用）", async () => {
    const client = buildClient(queuedModel([
      { extracted: true, items: [ITEM_A] },
      { extracted: true, items: [ITEM_B] },
    ]));
    const created = await client["knowledge-bases"].$post({
      form: { files: [pdfFile("a.pdf"), pdfFile("b.pdf")] },
    });
    expect(created.status).toBe(200);
    if (created.status !== 200)
      return;
    const createdJson = await created.json();

    const response = await client["knowledge-bases"][":id"].$get({ param: { id: createdJson.knowledgeBaseId } });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const detail = await response.json();
    expect(detail.status).toBe("draft");
    expect(detail.draft).toEqual({ extracted: true, items: createdJson.items });
  });
});

describe("post /knowledge-bases/{id}/commit", () => {
  async function createDraftBase(client: ReturnType<typeof buildClient>) {
    const created = await client["knowledge-bases"].$post({ form: { files: pdfFile() } });
    expect(created.status).toBe(200);
    if (created.status !== 200) {
      throw new Error("上傳失敗，測試前提不成立");
    }
    return created.json();
  }

  it("commit 後回 {knowledgeBaseId, status: committed, facts}，facts 掛 knowledgeBaseId", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));
    const created = await createDraftBase(client);
    const draft = created.items[0];

    const response = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: created.knowledgeBaseId },
      json: {
        items: [{
          id: draft.suggestedId,
          label: draft.label,
          content: draft.content,
          tags: draft.tags,
          volatility: draft.volatility,
          internal: false,
        }],
      },
    });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.knowledgeBaseId).toBe(created.knowledgeBaseId);
    expect(json.status).toBe("committed");
    expect(json.facts).toHaveLength(1);
    expect(json.facts[0].knowledgeBaseId).toBe(created.knowledgeBaseId);

    const facts = await store.listFacts();
    expect(facts.map(fact => fact.id)).toContain(draft.suggestedId);

    const detail = await baseStore.getById(created.knowledgeBaseId);
    expect(detail?.status).toBe("committed");
  });

  it("id 撞到手動維護的既有 fact 回 409；同一知識庫重複 commit 允許", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));
    const created = await createDraftBase(client);
    await store.upsertFact("manual-fact", { label: "手動", tags: [], content: "手動維護", volatility: "low" });

    const conflict = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: created.knowledgeBaseId },
      json: { items: [{ id: "manual-fact", label: "x", content: "x", tags: [], volatility: "low", internal: false }] },
    });
    expect(conflict.status).toBe(409);
    expect((await store.listFacts()).find(fact => fact.id === "manual-fact")?.content).toBe("手動維護");

    const commitOnce = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: created.knowledgeBaseId },
      json: { items: [{ id: "kb-fact", label: "第一版", content: "v1", tags: [], volatility: "low", internal: false }] },
    });
    expect(commitOnce.status).toBe(200);

    const commitTwice = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: created.knowledgeBaseId },
      json: { items: [{ id: "kb-fact", label: "第二版", content: "v2", tags: [], volatility: "low", internal: false }] },
    });
    expect(commitTwice.status).toBe(200);
    expect((await store.listFacts()).find(fact => fact.id === "kb-fact")?.content).toBe("v2");
  });

  it("_TODO 前綴 id 回 400 且整批 rollback；不存在的知識庫回 404", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));
    const created = await createDraftBase(client);

    const badId = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: created.knowledgeBaseId },
      json: {
        items: [
          { id: "ok-fact", label: "ok", content: "ok", tags: [], volatility: "low", internal: false },
          { id: "_TODO-x", label: "bad", content: "bad", tags: [], volatility: "low", internal: false },
        ],
      },
    });
    expect(badId.status).toBe(400);
    expect((await store.listFacts()).map(fact => fact.id)).not.toContain("ok-fact");

    const notFound = await client["knowledge-bases"][":id"].commit.$post({
      param: { id: "00000000-0000-4000-8000-000000000000" },
      json: { items: [{ id: "x", label: "x", content: "x", tags: [], volatility: "low", internal: false }] },
    });
    expect(notFound.status).toBe(404);
  });
});

describe("delete /knowledge-bases/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildClient(queuedModel([]));
    const response = await client["knowledge-bases"][":id"].$delete({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("刪知識庫：documents 與 commit 出來的 facts 連動刪除，手動維護的 facts 保留", async () => {
    const client = buildClient(queuedModel([{ extracted: true, items: [ITEM_A] }]));
    const created = await client["knowledge-bases"].$post({ form: { files: pdfFile() } });
    expect(created.status).toBe(200);
    if (created.status !== 200)
      return;
    const createdJson = await created.json();
    const draft = createdJson.items[0];

    await client["knowledge-bases"][":id"].commit.$post({
      param: { id: createdJson.knowledgeBaseId },
      json: {
        items: [{
          id: draft.suggestedId,
          label: draft.label,
          content: draft.content,
          tags: draft.tags,
          volatility: draft.volatility,
          internal: false,
        }],
      },
    });
    await store.upsertFact("manual-fact", { label: "手動", tags: [], content: "不該被刪", volatility: "low" });

    const response = await client["knowledge-bases"][":id"].$delete({ param: { id: createdJson.knowledgeBaseId } });
    expect(response.status).toBe(204);

    expect(await baseStore.getById(createdJson.knowledgeBaseId)).toBeUndefined();
    const factIds = (await store.listFacts()).map(fact => fact.id);
    expect(factIds).not.toContain(draft.suggestedId);
    expect(factIds).toContain("manual-fact");
  });
});
