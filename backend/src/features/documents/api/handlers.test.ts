import type { LanguageModel } from "ai";

import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { TestDb } from "@/db/test-client";

import { facts as factsTable } from "@/db/schema";
import { createTestDb } from "@/db/test-client";
import { createKnowledgeRouter } from "@/features/knowledge/api";
import { createTestApp } from "@/lib/create-app";
import { DbKnowledgeDocumentStore, DbKnowledgeStore, DbProjectStore } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

import { createDocumentServices } from "../services";
import { createDocumentsRouter } from "./index";

/**
 * 每個測試都用一份全新的 pglite（記憶體內 Postgres），套用真正的 migration SQL，
 * 不連真的 Postgres、不打真的 OpenAI（LLM 一律用 MockLanguageModelV4 注入）。
 */
let db: TestDb;
let store: DbKnowledgeStore;
let documentStore: DbKnowledgeDocumentStore;

const fixturesDir = path.resolve(__dirname, "../fixtures");
const samplePdfBytes = fs.readFileSync(path.join(fixturesDir, "sample.pdf"));
const blankPdfBytes = fs.readFileSync(path.join(fixturesDir, "blank.pdf"));

beforeEach(async () => {
  db = await createTestDb();
  store = new DbKnowledgeStore(db);
  documentStore = new DbKnowledgeDocumentStore(db);
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

function buildClient(model: LanguageModel) {
  const promptLayers = loadPromptLayers();
  const services = createDocumentServices({
    model,
    documents: documentStore,
    knowledge: store,
    projects: new DbProjectStore(db),
    promptLayers,
  });
  return testClient(createTestApp(createDocumentsRouter(services)));
}

function neverCallModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("不該呼叫 LLM（這個測試預期在打 LLM 之前就短路）");
    },
  });
}

interface DraftItemInput {
  label: string;
  content: string;
  tags: string[];
  volatility: "high" | "low";
  usage?: "internal";
}

/** 上傳一份合法 PDF，用 mock LLM 回固定的抽取結果，回傳 client 與上傳回應 json。 */
async function uploadAndExtract(items: DraftItemInput[], projectId?: string) {
  const model = new MockLanguageModelV4({
    doGenerate: async () => textResult({ extracted: true, items }),
  });
  const client = buildClient(model);
  const file = new File([samplePdfBytes], "報價單.pdf", { type: "application/pdf" });

  const response = await client.knowledge.documents.$post({
    form: { file, ...(projectId === undefined ? {} : { projectId }) },
  });
  expect(response.status).toBe(200);
  if (response.status !== 200) {
    throw new Error("上傳失敗，測試前提不成立");
  }
  const json = await response.json();
  return { client, json };
}

describe("post /knowledge/documents", () => {
  it("上傳合法 PDF，回抽取草稿（含後端生成的 suggestedId）", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        extracted: true,
        items: [
          { label: "Y 方案報價", content: "Y 方案 8 萬，含企劃與拍攝。", tags: ["報價", "價格"], volatility: "high" },
        ],
      }),
    });
    const client = buildClient(model);
    const file = new File([samplePdfBytes], "報價單.pdf", { type: "application/pdf" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();

    expect(json.status).toBe("extracted");
    expect(json.extracted).toBe(true);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].suggestedId).toMatch(/^pdf-/);
    expect(json.items[0].label).toBe("Y 方案報價");

    const detail = await documentStore.getById(json.documentId);
    expect(detail?.status).toBe("extracted");
    expect(detail?.fileName).toBe("報價單.pdf");
  });

  it("引擎判定整份文件抽不到事實時，回 200 但 items 空陣列並帶 reason", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({ extracted: false, reason: "這份文件我讀不到具體的數字或條件" }),
    });
    const client = buildClient(model);
    const file = new File([samplePdfBytes], "目錄頁.pdf", { type: "application/pdf" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.extracted).toBe(false);
    expect(json.items).toEqual([]);
    expect(json.reason).toBe("這份文件我讀不到具體的數字或條件");
  });

  it("非 PDF 檔案回 415，且不建立 document 紀錄", async () => {
    const client = buildClient(neverCallModel());
    const file = new File(["hello world"], "note.txt", { type: "text/plain" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(415);

    const list = await documentStore.list();
    expect(list).toHaveLength(0);
  });

  it("副檔名是 .pdf、但 MIME 是 application/octet-stream（如 Android／OkHttp）：仍視為 PDF，可正常上傳", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        extracted: true,
        items: [{ label: "A", content: "內容 A", tags: ["a"], volatility: "low" }],
      }),
    });
    const client = buildClient(model);
    const file = new File([samplePdfBytes], "報價單.pdf", { type: "application/octet-stream" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json.extracted).toBe(true);
    expect(json.items).toHaveLength(1);
  });

  it("檔名是 .pdf 但內容毀損／根本不是 PDF：回 400（不是 422），document 標記為 failed", async () => {
    const client = buildClient(neverCallModel());
    const garbageBytes = new TextEncoder().encode("這不是 PDF 內容，只是純文字假冒成 .pdf");
    const file = new File([garbageBytes], "假冒.pdf", { type: "application/pdf" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(400);

    const list = await documentStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("failed");
    expect(list[0].errorReason).toBeTruthy();
  });

  it("上傳的 PDF 無可抽文字（掃描檔／純圖）回 422，document 標記為 failed", async () => {
    const client = buildClient(neverCallModel());
    const file = new File([blankPdfBytes], "scan.pdf", { type: "application/pdf" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(422);

    const list = await documentStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("failed");
    expect(list[0].errorReason).toBeTruthy();
  });

  it("LLM 呼叫失敗（重試一次後仍失敗）回 502，document 標記為 failed 而非卡在 parsing", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("Incorrect API key provided");
      },
    });
    const client = buildClient(model);
    const file = new File([samplePdfBytes], "報價單.pdf", { type: "application/pdf" });

    const response = await client.knowledge.documents.$post({ form: { file } });
    expect(response.status).toBe(502);

    const list = await documentStore.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("failed");
    expect(list[0].errorReason).toBeTruthy();
    expect(list[0].errorReason).toContain("Incorrect API key provided");
    // PDF 本身有解析成功，頁數應該被寫入，不應該因為後面 LLM 失敗就留 null。
    expect(list[0].pageCount).not.toBeNull();
  });

  it("檔案超過 10MB 上限回 413，且不建立 document 紀錄", async () => {
    const client = buildClient(neverCallModel());
    const oversizedByteLength = 10 * 1024 * 1024 + 1024;
    const oversizedBytes = new Uint8Array(oversizedByteLength);
    const file = new File([oversizedBytes], "huge.pdf", { type: "application/pdf" });

    // hono 的 body-limit middleware 讀 Request 的 content-length header 來短路判斷（見
    // hono/middleware/body-limit）；沒有這個 header 時會退回逐 chunk 讀 stream 計數，
    // 但那條路徑在 hono 的 form validator 內部會把 body-limit 的錯誤吃成通用的
    // 400「Malformed FormData request」，蓋掉真正的 413（framework 本身的已知限制）。
    // 真實 HTTP 請求（瀏覽器／curl）送 multipart body 時一定會帶 content-length，
    // 所以這裡手動補上，讓測試走到跟生產環境相同的短路分支。
    const response = await client.knowledge.documents.$post(
      { form: { file } },
      { headers: { "content-length": String(oversizedByteLength) } },
    );
    expect(response.status).toBe(413);

    const list = await documentStore.list();
    expect(list).toHaveLength(0);
  });
});

describe("get /knowledge/documents", () => {
  it("列表不含 extracted_draft 全文", async () => {
    const { client } = await uploadAndExtract([
      { label: "A", content: "內容 A", tags: ["a"], volatility: "low" },
    ]);
    const response = await client.knowledge.documents.$get();
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const json = await response.json();
    expect(json).toHaveLength(1);
    expect(json[0]).not.toHaveProperty("draft");
  });
});

describe("get /knowledge/documents/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildClient(neverCallModel());
    const response = await client.knowledge.documents[":id"].$get({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("回單一文件的狀態與草稿 items", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "A", content: "內容 A", tags: ["a"], volatility: "low" },
    ]);
    const response = await client.knowledge.documents[":id"].$get({ param: { id: json.documentId } });
    expect(response.status).toBe(200);
    if (response.status !== 200)
      return;
    const detail = await response.json();
    expect(detail.status).toBe("extracted");
    expect(detail.draft).toEqual({ extracted: true, items: json.items });
  });
});

describe("post /knowledge/documents/{id}/commit", () => {
  it("上傳時帶 projectId：文件紀錄保存 projectId，commit 出來的 facts 繼承；專案不存在回 400", async () => {
    const project = await new DbProjectStore(db).create("宏碩 Q4 報價案");
    const { client, json } = await uploadAndExtract([
      { label: "A", content: "內容 A", tags: ["a"], volatility: "low" },
    ], project.id);

    const detail = await documentStore.getById(json.documentId);
    expect(detail?.projectId).toBe(project.id);

    const draft = json.items[0];
    const commitResponse = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
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
    expect(commitResponse.status).toBe(200);
    if (commitResponse.status !== 200)
      return;
    const facts = await commitResponse.json();
    expect(facts[0].projectId).toBe(project.id);

    const missingProject = await client.knowledge.documents.$post({
      form: {
        file: new File([samplePdfBytes], "報價單.pdf", { type: "application/pdf" }),
        projectId: "00000000-0000-4000-8000-000000000000",
      },
    });
    expect(missingProject.status).toBe(400);
  });

  it("上傳帶 projectName：沒有同名專案就自動建立，再次上傳同名共用同一個專案；與 projectId 同時帶回 400", async () => {
    const projectStore = new DbProjectStore(db);
    const model = new MockLanguageModelV4({
      doGenerate: async () => textResult({
        extracted: true,
        items: [{ label: "A", content: "內容 A", tags: ["a"], volatility: "low" }],
      }),
    });
    const client = buildClient(model);
    const upload = (extra: Record<string, string>) => client.knowledge.documents.$post({
      form: { file: new File([samplePdfBytes], "報價單.pdf", { type: "application/pdf" }), ...extra },
    });

    const first = await upload({ projectName: "宏碩 Q4 報價案" });
    expect(first.status).toBe(200);
    if (first.status !== 200)
      return;
    const firstJson = await first.json();
    expect(firstJson.projectId).not.toBeNull();

    const second = await upload({ projectName: "宏碩 Q4 報價案" });
    expect(second.status).toBe(200);
    if (second.status !== 200)
      return;
    expect((await second.json()).projectId).toBe(firstJson.projectId);

    const projects = await projectStore.list();
    expect(projects.filter(project => project.name === "宏碩 Q4 報價案")).toHaveLength(1);

    const both = await upload({
      projectName: "宏碩 Q4 報價案",
      projectId: firstJson.projectId ?? "",
    });
    expect(both.status).toBe(400);
  });

  it("commit 後寫入 facts，GET /v1/facts 看得到新 fact 且 source_document_id 正確", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "Y 方案報價", content: "Y 方案 8 萬。", tags: ["報價"], volatility: "high" },
    ]);
    const draft = json.items[0];

    const commitResponse = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
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
    expect(commitResponse.status).toBe(200);
    if (commitResponse.status !== 200)
      return;
    const facts = await commitResponse.json();
    expect(facts).toHaveLength(1);
    expect(facts[0].id).toBe(draft.suggestedId);

    // GET /v1/facts（既有 knowledge feature）立刻看得到新 fact，同一個 DB。
    const knowledgeClient = testClient(createTestApp(createKnowledgeRouter(store)));
    const listResponse = await knowledgeClient.facts.$get();
    const list = await listResponse.json();
    expect(list.map(fact => fact.id)).toContain(draft.suggestedId);

    // source_document_id 是內部欄位，Fact 對外契約不曝光，直接查 DB 驗證。
    const [row] = await db.select().from(factsTable).where(eq(factsTable.id, draft.suggestedId));
    expect(row.sourceDocumentId).toBe(json.documentId);

    const detail = await documentStore.getById(json.documentId);
    expect(detail?.status).toBe("committed");
  });

  it("internal 開關映射成 Fact.usage = internal", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "底線", content: "最低 7 萬。", tags: ["底線"], volatility: "high", usage: "internal" },
    ]);
    const draft = json.items[0];
    expect(draft.usage).toBe("internal");

    const commitResponse = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
      json: {
        items: [{
          id: draft.suggestedId,
          label: draft.label,
          content: draft.content,
          tags: draft.tags,
          volatility: draft.volatility,
          internal: true,
        }],
      },
    });
    expect(commitResponse.status).toBe(200);
    if (commitResponse.status !== 200)
      return;
    const [fact] = await commitResponse.json();
    expect(fact.usage).toBe("internal");
  });

  it("commit 走 transaction：其中一筆 id 不合法時，整批都不寫入、文件狀態不變", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "A", content: "內容 A", tags: ["a"], volatility: "low" },
      { label: "B", content: "內容 B", tags: ["b"], volatility: "low" },
    ]);
    const [itemA, itemB] = json.items;

    const commitResponse = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
      json: {
        items: [
          { id: itemA.suggestedId, label: itemA.label, content: itemA.content, tags: itemA.tags, volatility: itemA.volatility, internal: false },
          { id: "_TODO-bad", label: itemB.label, content: itemB.content, tags: itemB.tags, volatility: itemB.volatility, internal: false },
        ],
      },
    });
    expect(commitResponse.status).toBe(400);

    const rowsA = await db.select().from(factsTable).where(eq(factsTable.id, itemA.suggestedId));
    expect(rowsA).toHaveLength(0);

    const detail = await documentStore.getById(json.documentId);
    expect(detail?.status).toBe("extracted");
  });

  it("文件不存在回 404", async () => {
    const client = buildClient(neverCallModel());
    const response = await client.knowledge.documents[":id"].commit.$post({
      param: { id: "00000000-0000-0000-0000-000000000000" },
      json: { items: [{ id: "x", label: "x", content: "x", tags: [], volatility: "low", internal: false }] },
    });
    expect(response.status).toBe(404);
  });

  it("commit body 的 id 撞到別份文件／手動維護的既有 fact：回 409，不覆蓋原內容", async () => {
    // 模擬使用者手動維護的既有事實（沒有 source_document_id）。
    await store.upsertFact("manual-fact", {
      label: "手動維護的事實",
      content: "原始內容，不該被覆蓋",
      tags: ["手動"],
      volatility: "low",
    });

    const { client, json } = await uploadAndExtract([
      { label: "A", content: "內容 A", tags: ["a"], volatility: "low" },
    ]);
    const draft = json.items[0];

    // commit body 的 id 是使用者可編輯欄位——這裡故意改成別人已存在的 id，
    // 而不是後端生成的 suggestedId（generateSuggestedIds 本身不會撞到既有 id）。
    const commitResponse = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
      json: {
        items: [{
          id: "manual-fact",
          label: draft.label,
          content: draft.content,
          tags: draft.tags,
          volatility: draft.volatility,
          internal: false,
        }],
      },
    });
    expect(commitResponse.status).toBe(409);

    const [row] = await db.select().from(factsTable).where(eq(factsTable.id, "manual-fact"));
    expect(row.content).toBe("原始內容，不該被覆蓋");
    expect(row.sourceDocumentId).toBeNull();

    // 文件狀態不因衝突而變成 committed。
    const detail = await documentStore.getById(json.documentId);
    expect(detail?.status).toBe("extracted");
  });

  it("同一份文件重複 commit 自己先前產生的 fact：允許（不是 409），內容會更新", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "A", content: "第一次內容", tags: ["a"], volatility: "low" },
    ]);
    const draft = json.items[0];
    const commitBody = {
      param: { id: json.documentId },
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
    };

    const firstCommit = await client.knowledge.documents[":id"].commit.$post(commitBody);
    expect(firstCommit.status).toBe(200);

    // 同一份文件、同一個 id 再 commit 一次（例如使用者回頭改了草稿內容再送出一次）。
    const secondCommit = await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
      json: {
        items: [{
          id: draft.suggestedId,
          label: draft.label,
          content: "更新後的內容",
          tags: draft.tags,
          volatility: draft.volatility,
          internal: false,
        }],
      },
    });
    expect(secondCommit.status).toBe(200);
    if (secondCommit.status !== 200)
      return;
    const [fact] = await secondCommit.json();
    expect(fact.content).toBe("更新後的內容");
  });
});

describe("delete /knowledge/documents/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildClient(neverCallModel());
    const response = await client.knowledge.documents[":id"].$delete({ param: { id: "not-exist" } });
    expect(response.status).toBe(404);
  });

  it("刪除文件後，已 commit 的 facts 仍在但溯源變 null", async () => {
    const { client, json } = await uploadAndExtract([
      { label: "Y 方案報價", content: "Y 方案 8 萬。", tags: ["報價"], volatility: "high" },
    ]);
    const draft = json.items[0];

    await client.knowledge.documents[":id"].commit.$post({
      param: { id: json.documentId },
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

    const deleteResponse = await client.knowledge.documents[":id"].$delete({ param: { id: json.documentId } });
    expect(deleteResponse.status).toBe(204);

    const [row] = await db.select().from(factsTable).where(eq(factsTable.id, draft.suggestedId));
    expect(row).toBeDefined();
    expect(row.sourceDocumentId).toBeNull();

    const getResponse = await client.knowledge.documents[":id"].$get({ param: { id: json.documentId } });
    expect(getResponse.status).toBe(404);
  });
});
