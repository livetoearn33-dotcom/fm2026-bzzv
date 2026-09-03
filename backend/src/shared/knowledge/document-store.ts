import { desc, eq } from "drizzle-orm";

import { knowledgeDocuments as documentsTable, facts as factsTable } from "@/db/schema";
import { ValidationError } from "@/shared/errors";

import type { ExtractedDraft, KnowledgeDocumentDetail, KnowledgeDocumentSummary } from "./document-types";
import type { AnyPgDatabase } from "./store";
import type { Fact } from "./types";

import { isTodoId } from "./repository";
import { factRowToFact, todayDateString } from "./store";
import { FactSchema } from "./types";

type DocumentRow = typeof documentsTable.$inferSelect;

/**
 * knowledge_documents.id 是 uuid 欄位——用非 uuid 格式的字串（如 "not-exist"）查詢，
 * Postgres／pglite 會在型別轉換階段直接丟錯（500），而不是回空結果。呼叫端想要的其實是
 * 「查無此文件」（404），所以在打 DB 之前先擋掉格式不合法的 id，一律當「不存在」處理。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDocumentId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export interface DocumentCreateInput {
  fileName: string;
  mimeType: string;
  byteSize: number;
}

/** 使用者確認／編輯過的單筆草稿——`internal` 是前端可勾選的開關，映射成 Fact.usage。 */
export interface DocumentCommitItemInput {
  id: string;
  label: string;
  content: string;
  tags: string[];
  volatility: "high" | "low";
  internal: boolean;
}

function documentRowToSummary(row: DocumentRow): KnowledgeDocumentSummary {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    pageCount: row.pageCount,
    status: row.status,
    errorReason: row.errorReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface KnowledgeDocumentRepository {
  create: (input: DocumentCreateInput) => Promise<KnowledgeDocumentSummary>;
  markExtracted: (id: string, pageCount: number, draft: ExtractedDraft) => Promise<void>;
  markFailed: (id: string, reason: string, pageCount?: number) => Promise<void>;
  list: () => Promise<KnowledgeDocumentSummary[]>;
  getById: (id: string) => Promise<KnowledgeDocumentDetail | undefined>;
  /** 單一 transaction 內批次 upsert facts（設 source_document_id）並把 document 狀態改成 committed。 */
  commit: (id: string, items: DocumentCommitItemInput[]) => Promise<Fact[]>;
  remove: (id: string) => Promise<boolean>;
}

/**
 * knowledge_documents 的 Postgres／Drizzle 實作。跟 DbKnowledgeStore（store.ts）
 * 分開成兩個 class：一個管 facts/contacts CRUD，一個管「PDF → 草稿 → 確認」這條線，
 * 但共用同一個 db 實例與 facts 表，commit 時互相接得上。
 */
export class DbKnowledgeDocumentStore implements KnowledgeDocumentRepository {
  constructor(private readonly db: AnyPgDatabase) {}

  async create(input: DocumentCreateInput): Promise<KnowledgeDocumentSummary> {
    const [row] = await this.db
      .insert(documentsTable)
      .values({
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        status: "parsing",
      })
      .returning();

    return documentRowToSummary(row);
  }

  async markExtracted(id: string, pageCount: number, draft: ExtractedDraft): Promise<void> {
    await this.db
      .update(documentsTable)
      .set({ status: "extracted", pageCount, extractedDraft: draft, errorReason: null })
      .where(eq(documentsTable.id, id));
  }

  async markFailed(id: string, reason: string, pageCount?: number): Promise<void> {
    await this.db
      .update(documentsTable)
      .set({ status: "failed", errorReason: reason, ...(pageCount === undefined ? {} : { pageCount }) })
      .where(eq(documentsTable.id, id));
  }

  async list(): Promise<KnowledgeDocumentSummary[]> {
    const rows = await this.db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt));
    return rows.map(documentRowToSummary);
  }

  async getById(id: string): Promise<KnowledgeDocumentDetail | undefined> {
    if (!isValidDocumentId(id)) {
      return undefined;
    }
    const [row] = await this.db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!row) {
      return undefined;
    }
    return {
      ...documentRowToSummary(row),
      draft: (row.extractedDraft as ExtractedDraft | null) ?? null,
    };
  }

  /**
   * `_TODO` 前綴檢查故意放在 transaction 迴圈「裡面」而不是先掃一輪再開 transaction：
   * 這樣前面已成功 insert 的項目會跟著這筆失敗一起 rollback，才是真的「不留半套資料」。
   */
  async commit(id: string, items: DocumentCommitItemInput[]): Promise<Fact[]> {
    return this.db.transaction(async (tx) => {
      const updatedAtString = todayDateString();
      const updatedAt = new Date(`${updatedAtString}T00:00:00.000Z`);
      const results: Fact[] = [];

      for (const item of items) {
        if (isTodoId(item.id)) {
          throw new ValidationError(`id 不可為保留前綴 _TODO：${item.id}`);
        }

        const parsed = FactSchema.parse({
          id: item.id,
          label: item.label,
          content: item.content,
          tags: item.tags,
          volatility: item.volatility,
          usage: item.internal ? "internal" : undefined,
          updatedAt: updatedAtString,
        });

        const [row] = await tx
          .insert(factsTable)
          .values({
            id: parsed.id,
            label: parsed.label,
            content: parsed.content,
            tags: parsed.tags,
            volatility: parsed.volatility,
            usage: parsed.usage,
            sourceDocumentId: id,
            updatedAt,
          })
          .onConflictDoUpdate({
            target: factsTable.id,
            set: {
              label: parsed.label,
              content: parsed.content,
              tags: parsed.tags,
              volatility: parsed.volatility,
              usage: parsed.usage ?? null,
              sourceDocumentId: id,
              updatedAt,
            },
          })
          .returning();

        results.push(factRowToFact(row));
      }

      await tx.update(documentsTable).set({ status: "committed" }).where(eq(documentsTable.id, id));

      return results;
    });
  }

  async remove(id: string): Promise<boolean> {
    if (!isValidDocumentId(id)) {
      return false;
    }
    const deleted = await this.db
      .delete(documentsTable)
      .where(eq(documentsTable.id, id))
      .returning({ id: documentsTable.id });
    return deleted.length > 0;
  }
}
