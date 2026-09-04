import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it } from "vitest";

import type { TestDb } from "@/db/test-client";

import { createTestDb } from "@/db/test-client";
import { createTestApp } from "@/lib/create-app";
import { DbKnowledgeStore, DbProjectStore } from "@/shared/knowledge";

import { createProjectsRouter } from "./index";

/**
 * 每個測試都用一份全新的 pglite（記憶體內 Postgres），套用真正的 migration SQL。
 */
let db: TestDb;
let store: DbProjectStore;

beforeEach(async () => {
  db = await createTestDb();
  store = new DbProjectStore(db);
});

function buildProjectsClient() {
  return testClient(createTestApp(createProjectsRouter(store)));
}

describe("post /projects", () => {
  it("建立專案回 201，id 由後端生成", async () => {
    const client = buildProjectsClient();
    const response = await client.projects.$post({ json: { name: "宏碩 Q4 報價案" } });
    expect(response.status).toBe(201);
    if (response.status !== 201)
      return;
    const json = await response.json();
    expect(json.name).toBe("宏碩 Q4 報價案");
    expect(json.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("name 空字串回 422", async () => {
    const client = buildProjectsClient();
    const response = await client.projects.$post({ json: { name: "" } });
    expect(response.status).toBe(422);
  });
});

describe("get /projects", () => {
  it("列出全部專案（新→舊）", async () => {
    await store.create("專案一");
    await store.create("專案二");
    const client = buildProjectsClient();
    const response = await client.projects.$get();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.map(project => project.name)).toEqual(["專案二", "專案一"]);
  });
});

describe("put /projects/{id}", () => {
  it("改名回 200；不存在（含非 uuid 格式）回 404", async () => {
    const project = await store.create("舊名字");
    const client = buildProjectsClient();

    const renamed = await client.projects[":id"].$put({
      param: { id: project.id },
      json: { name: "新名字" },
    });
    expect(renamed.status).toBe(200);
    if (renamed.status !== 200)
      return;
    expect((await renamed.json()).name).toBe("新名字");

    const notFound = await client.projects[":id"].$put({
      param: { id: "not-a-uuid" },
      json: { name: "x" },
    });
    expect(notFound.status).toBe(404);
  });
});

describe("delete /projects/{id}", () => {
  it("不存在回 404", async () => {
    const client = buildProjectsClient();
    const response = await client.projects[":id"].$delete({ param: { id: "not-a-uuid" } });
    expect(response.status).toBe(404);
  });

  it("刪除專案後，掛在底下的 fact 保留但 projectId 脫鉤變省略", async () => {
    const project = await store.create("要刪的專案");
    const knowledge = new DbKnowledgeStore(db);
    await knowledge.upsertFact("fact-under-project", {
      label: "事實",
      tags: [],
      content: "內容",
      volatility: "low",
      projectId: project.id,
    });

    const client = buildProjectsClient();
    const response = await client.projects[":id"].$delete({ param: { id: project.id } });
    expect(response.status).toBe(204);

    const facts = await knowledge.listFacts();
    const fact = facts.find(item => item.id === "fact-under-project");
    expect(fact).toBeDefined();
    // 不經 JSON 序列化，zod parse 會留下值為 undefined 的 key——驗值不驗 key
    expect(fact?.projectId).toBeUndefined();
  });
});
