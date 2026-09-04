import type { PgDatabase } from "drizzle-orm/pg-core";

import { eq } from "drizzle-orm";

import type * as schema from "@/db/schema";

import { contacts as contactsTable, facts as factsTable, projects as projectsTable } from "@/db/schema";
import { ValidationError } from "@/shared/errors";

import type { Contact, Fact } from "./types";

import { isTodoId } from "./repository";
import { ContactSchema, FactSchema } from "./types";

/** PUT body 不含 id（id 取自路徑）；facts 額外允許省略 updatedAt，後端補今天日期。 */
export type ContactUpsertInput = Omit<Contact, "id">;
export type FactUpsertInput = Omit<Fact, "id" | "updatedAt"> & { updatedAt?: string };

/**
 * 任何 drizzle pg 風味的 db 實例都能用（node-postgres 或 pglite）——production 與測試共用同一份
 * repository 邏輯。query result 的 HKT 用 any：兩種 driver 的 HKT 不同，只在乎 select/insert/
 * delete 這些 query builder 方法，不在乎底層 raw result 的型別。
 */
export type AnyPgDatabase = PgDatabase<any, typeof schema>;

/** 匯出給 document-store.ts 共用（commit 時的 fact.updatedAt 也補今天日期）。 */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** DB 的 timestamptz → 對外 API 契約的 YYYY-MM-DD 字串（不改變 Fact 的對外格式）。 */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * projectId 有帶時先確認專案存在——不存在就回 400（ValidationError），
 * 不要放給 FK violation 變成 500。projectId 已在 API 層用 zod .uuid() 驗過格式，
 * 這裡直接查不會有 uuid cast error。匯出給 document-store.ts 共用。
 */
export async function assertProjectExists(db: AnyPgDatabase, projectId: string): Promise<void> {
  const [row] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!row) {
    throw new ValidationError(`找不到專案：${projectId}`);
  }
}

type FactRow = typeof factsTable.$inferSelect;
type ContactRow = typeof contactsTable.$inferSelect;

/** 匯出給 document-store.ts 共用（commit 完 fact 後轉成對外 Fact 形狀）。 */
export function factRowToFact(row: FactRow): Fact {
  return FactSchema.parse({
    id: row.id,
    label: row.label,
    tags: row.tags,
    content: row.content,
    updatedAt: toDateOnlyString(row.updatedAt),
    volatility: row.volatility,
    usage: row.usage ?? undefined,
    projectId: row.projectId ?? undefined,
  });
}

function contactRowToContact(row: ContactRow): Contact {
  return ContactSchema.parse({
    id: row.id,
    name: row.name,
    role: row.role,
    tone: row.tone,
    notes: row.notes,
    recentTopics: row.recentTopics,
    projectId: row.projectId ?? undefined,
  });
}

/** analyze/guard 只需要讀取，不需要整套 CRUD——依賴介面窄一點方便測試造假資料。 */
export interface KnowledgeReader {
  listFacts: () => Promise<Fact[]>;
  listContacts: () => Promise<Contact[]>;
}

export interface KnowledgeRepository extends KnowledgeReader {
  upsertFact: (id: string, body: FactUpsertInput) => Promise<Fact>;
  deleteFact: (id: string) => Promise<boolean>;
  upsertContact: (id: string, body: ContactUpsertInput) => Promise<Contact>;
  deleteContact: (id: string) => Promise<boolean>;
}

/**
 * 知識庫儲存層的 Postgres／Drizzle 實作（取代原本 JSON write-through 的
 * LiveKnowledgeStore）。真源在資料庫，不再寫任何檔案。
 *
 * `_TODO` 前綴的保留規則沿用舊版：PUT/DELETE 一律拒絕；但既有的 JSON 骨架筆
 * 本來就不會被 seed 進資料庫（見 src/db/seed.ts 沿用 loadFacts/loadContacts
 * 的過濾），所以這裡的 isTodoId 檢查只用來擋「client 想用 _TODO 開頭建新資料」。
 */
export class DbKnowledgeStore implements KnowledgeRepository {
  constructor(private readonly db: AnyPgDatabase) {}

  async listFacts(): Promise<Fact[]> {
    const rows = await this.db.select().from(factsTable);
    return rows.map(factRowToFact);
  }

  async listContacts(): Promise<Contact[]> {
    const rows = await this.db.select().from(contactsTable);
    return rows.map(contactRowToContact);
  }

  async upsertFact(id: string, body: FactUpsertInput): Promise<Fact> {
    if (isTodoId(id)) {
      throw new ValidationError(`id 不可為保留前綴 _TODO：${id}`);
    }
    const updatedAtString = body.updatedAt && body.updatedAt.length > 0 ? body.updatedAt : todayDateString();
    const parsed = FactSchema.parse({ ...body, id, updatedAt: updatedAtString });
    if (parsed.projectId) {
      await assertProjectExists(this.db, parsed.projectId);
    }

    const [row] = await this.db
      .insert(factsTable)
      .values({
        id: parsed.id,
        label: parsed.label,
        content: parsed.content,
        tags: parsed.tags,
        volatility: parsed.volatility,
        usage: parsed.usage,
        projectId: parsed.projectId,
        updatedAt: new Date(`${updatedAtString}T00:00:00.000Z`),
      })
      .onConflictDoUpdate({
        target: factsTable.id,
        set: {
          label: parsed.label,
          content: parsed.content,
          tags: parsed.tags,
          volatility: parsed.volatility,
          usage: parsed.usage ?? null,
          projectId: parsed.projectId ?? null,
          updatedAt: new Date(`${updatedAtString}T00:00:00.000Z`),
        },
      })
      .returning();

    return factRowToFact(row);
  }

  async deleteFact(id: string): Promise<boolean> {
    if (isTodoId(id)) {
      return false;
    }
    const deleted = await this.db.delete(factsTable).where(eq(factsTable.id, id)).returning({ id: factsTable.id });
    return deleted.length > 0;
  }

  async upsertContact(id: string, body: ContactUpsertInput): Promise<Contact> {
    if (isTodoId(id)) {
      throw new ValidationError(`id 不可為保留前綴 _TODO：${id}`);
    }
    const parsed = ContactSchema.parse({ ...body, id });
    if (parsed.projectId) {
      await assertProjectExists(this.db, parsed.projectId);
    }

    const [row] = await this.db
      .insert(contactsTable)
      .values({
        id: parsed.id,
        name: parsed.name,
        role: parsed.role,
        tone: parsed.tone,
        notes: parsed.notes,
        recentTopics: parsed.recentTopics,
        projectId: parsed.projectId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: contactsTable.id,
        set: {
          name: parsed.name,
          role: parsed.role,
          tone: parsed.tone,
          notes: parsed.notes,
          recentTopics: parsed.recentTopics,
          projectId: parsed.projectId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return contactRowToContact(row);
  }

  async deleteContact(id: string): Promise<boolean> {
    if (isTodoId(id)) {
      return false;
    }
    const deleted = await this.db.delete(contactsTable).where(eq(contactsTable.id, id)).returning({ id: contactsTable.id });
    return deleted.length > 0;
  }
}

/** 把靜態的 Fact[]/Contact[] 包成 KnowledgeReader，方便測試不用起 DB 就能餵 analyze/guard services。 */
export function staticKnowledgeReader(facts: Fact[], contacts: Contact[]): KnowledgeReader {
  return {
    listFacts: async () => facts,
    listContacts: async () => contacts,
  };
}
