import { describe, expect, it } from "vitest";

import { loadContacts, loadFacts } from "@/shared/knowledge";

import type { TestDb } from "./test-client";

import { contacts as contactsTable, facts as factsTable } from "./schema";
import { seedIfEmpty, seedInto } from "./seed";
import { createTestDb } from "./test-client";

/**
 * 對應「部署後知識庫是空的」的修復：main.ts 啟動時呼叫 seedIfEmpty，只有 facts／contacts
 * 兩張表都是空的（全新部署）才會自動匯入 assets/data 的 demo 資料；只要任一張表已有資料
 * 就要跳過，不能把使用者刪掉的 demo 資料或手動維護的資料又塞回去。
 */
describe("seedIfEmpty", () => {
  // createTestDb（pglite＋整組 migration）單獨跑約 3 秒，全套併發時常超過預設 5 秒——放寬到 20 秒
  it("兩張表都是空的（全新部署）：自動 seed，筆數等於 loadFacts()/loadContacts()", { timeout: 20_000 }, async () => {
    const db: TestDb = await createTestDb();

    const result = await seedIfEmpty(db);

    expect(result.seeded).toBe(true);
    expect(result.factsInserted).toBe(loadFacts().length);
    expect(result.contactsInserted).toBe(loadContacts().length);

    const factRows = await db.select().from(factsTable);
    const contactRows = await db.select().from(contactsTable);
    expect(factRows.length).toBe(loadFacts().length);
    expect(contactRows.length).toBe(loadContacts().length);
  });

  it("再次呼叫（表已非空）：不重複 seed，回 seeded:false 且筆數不變", async () => {
    const db: TestDb = await createTestDb();

    await seedIfEmpty(db);
    const secondResult = await seedIfEmpty(db);

    expect(secondResult).toEqual({ seeded: false, factsInserted: 0, contactsInserted: 0 });

    const factRows = await db.select().from(factsTable);
    expect(factRows.length).toBe(loadFacts().length); // 沒有變成兩倍
  });

  it("facts 表已有資料、contacts 是空的：仍然跳過（不會只補 contacts、也不會動 facts）", async () => {
    const db: TestDb = await createTestDb();

    // 模擬「使用者手動維護了一筆 fact，但還沒有任何 contact」的狀態——不透過 seedInto，
    // 直接寫一筆非 demo 資料，確保它不會被自動 seed 蓋掉或補資料時受影響。
    await db.insert(factsTable).values({
      id: "manual-fact",
      label: "手動維護",
      content: "使用者自己加的事實",
      tags: [],
      volatility: "low",
    });

    const result = await seedIfEmpty(db);

    expect(result.seeded).toBe(false);
    const contactRows = await db.select().from(contactsTable);
    expect(contactRows).toHaveLength(0); // 沒有被自動補上 demo contacts

    const factRows = await db.select().from(factsTable);
    expect(factRows).toHaveLength(1);
    expect(factRows[0].id).toBe("manual-fact");
  });

  it("contacts 表已有資料、facts 是空的：仍然跳過", async () => {
    const db: TestDb = await createTestDb();

    await db.insert(contactsTable).values({
      id: "manual-contact",
      name: "手動維護",
      role: "role",
      tone: "tone",
      notes: "notes",
      recentTopics: [],
    });

    const result = await seedIfEmpty(db);

    expect(result.seeded).toBe(false);
    const factRows = await db.select().from(factsTable);
    expect(factRows).toHaveLength(0);
  });
});

/** seedInto 本身（手動 db:seed / db:seed:prod 用）維持既有行為：onConflictDoNothing，可重複執行。 */
describe("seedInto", () => {
  it("重複呼叫同一批資料：第二次 inserted 筆數為 0，不覆蓋既有資料", async () => {
    const db: TestDb = await createTestDb();
    const facts = loadFacts();
    const contacts = loadContacts();

    const first = await seedInto(db, facts, contacts);
    expect(first.factsInserted).toBe(facts.length);

    const second = await seedInto(db, facts, contacts);
    expect(second.factsInserted).toBe(0);
    expect(second.contactsInserted).toBe(0);
  });
});
