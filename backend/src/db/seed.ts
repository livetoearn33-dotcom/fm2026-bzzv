import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Contact, Fact } from "@/shared/knowledge";
import type { AnyPgDatabase } from "@/shared/knowledge/store";

import { loadContacts, loadFacts } from "@/shared/knowledge";

import { closeDb, createDb } from "./client";
import { contacts as contactsTable, facts as factsTable } from "./schema";

/**
 * 把 facts/contacts 陣列匯入指定的 db（production 用 Postgres、測試用 pglite 共用同一份邏輯）。
 * 用 onConflictDoNothing，同一筆 id 已存在就跳過——可重複執行。
 */
export async function seedInto(
  db: AnyPgDatabase,
  facts: Fact[],
  contacts: Contact[],
): Promise<{ factsInserted: number; contactsInserted: number }> {
  const insertedFacts = facts.length > 0
    ? await db
        .insert(factsTable)
        .values(facts.map(fact => ({
          id: fact.id,
          label: fact.label,
          content: fact.content,
          tags: fact.tags,
          volatility: fact.volatility,
          usage: fact.usage,
          knowledgeBaseId: fact.knowledgeBaseId,
          updatedAt: new Date(`${fact.updatedAt}T00:00:00.000Z`),
        })))
        .onConflictDoNothing()
        .returning({ id: factsTable.id })
    : [];

  const insertedContacts = contacts.length > 0
    ? await db
        .insert(contactsTable)
        .values(contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          role: contact.role,
          tone: contact.tone,
          notes: contact.notes,
          recentTopics: contact.recentTopics,
          knowledgeBaseId: contact.knowledgeBaseId,
        })))
        .onConflictDoNothing()
        .returning({ id: contactsTable.id })
    : [];

  return { factsInserted: insertedFacts.length, contactsInserted: insertedContacts.length };
}

/**
 * `pnpm db:seed` / `pnpm db:seed:prod` 入口：把 data/facts.json、data/contacts.json
 * （或正式映像內的 assets/data 副本，見 shared/knowledge/repository.ts 的 resolveDataDir）
 * 匯入 Postgres。`_TODO` 前綴的骨架筆沿用 loadFacts/loadContacts 既有過濾，不會被 seed 進去。
 */
export async function seed(): Promise<{ factsInserted: number; contactsInserted: number }> {
  const db = createDb();
  return seedInto(db, loadFacts(), loadContacts());
}

/**
 * 啟動時自動 seed 的守門邏輯：只有 facts／contacts 兩張表都是空的（全新部署、
 * migration 剛建完表）才會真的匯入資料；只要任一張表已經有資料，一律跳過——
 * 避免把使用者刪掉的 demo 資料，或使用者手動維護的 fact/contact，在下次重啟時
 * 又被塞回去。這是 main.ts 啟動流程呼叫的入口，`db:seed`/`db:seed:prod` 手動執行
 * 的 `seed()` 不受這層限制（手動重跑本來就是明確意圖，用 onConflictDoNothing 保護）。
 */
export async function seedIfEmpty(db: AnyPgDatabase): Promise<{
  seeded: boolean;
  factsInserted: number;
  contactsInserted: number;
}> {
  const [existingFact] = await db.select({ id: factsTable.id }).from(factsTable).limit(1);
  const [existingContact] = await db.select({ id: contactsTable.id }).from(contactsTable).limit(1);

  if (existingFact || existingContact) {
    return { seeded: false, factsInserted: 0, contactsInserted: 0 };
  }

  const result = await seedInto(db, loadFacts(), loadContacts());
  return { seeded: true, ...result };
}

const isMainModule = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  seed()
    .then(async (result) => {
      // eslint-disable-next-line no-console
      console.log(`✅ seed 完成：facts 新增 ${result.factsInserted} 筆，contacts 新增 ${result.contactsInserted} 筆（已存在的 id 略過）`);
      await closeDb();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("❌ seed failed", error);
      await closeDb();
      process.exit(1);
    });
}
