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
        })))
        .onConflictDoNothing()
        .returning({ id: contactsTable.id })
    : [];

  return { factsInserted: insertedFacts.length, contactsInserted: insertedContacts.length };
}

/**
 * `pnpm db:seed` 入口：把 repo 根目錄 data/facts.json、data/contacts.json 匯入 Postgres。
 * `_TODO` 前綴的骨架筆沿用 loadFacts/loadContacts 既有過濾，不會被 seed 進去。
 */
export async function seed(): Promise<{ factsInserted: number; contactsInserted: number }> {
  const db = createDb();
  return seedInto(db, loadFacts(), loadContacts());
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
