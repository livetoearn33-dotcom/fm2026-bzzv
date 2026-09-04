import { and, desc, eq, inArray } from "drizzle-orm";

import { knowledgeBases as basesTable, knowledgeDocuments as documentsTable, facts as factsTable } from "@/db/schema";
import { ConflictError, ValidationError } from "@/shared/errors";

import type {
  ExtractedDraft,
  ExtractedFactItem,
  KnowledgeBaseDetail,
  KnowledgeBaseFile,
  KnowledgeBaseSummary,
} from "./document-types";
import type { AnyPgDatabase } from "./store";
import type { Fact } from "./types";

import { isTodoId } from "./repository";
import { factRowToFact, todayDateString } from "./store";
import { FactSchema } from "./types";

type BaseRow = typeof basesTable.$inferSelect;
type DocumentRow = typeof documentsTable.$inferSelect;

/**
 * knowledge_bases.id 是 uuid 欄位——非 uuid 格式的字串直接打 DB 會在型別轉換階段
 * 丟錯（500），呼叫端想要的其實是「查無此知識庫」（404），先擋掉一律當「不存在」。
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBaseId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export interface KnowledgeBaseFileInput {
  fileName: string;
  mimeType: string;
  byteSize: number;
}

/** 使用者確認／編輯過的單筆草稿——`internal` 是前端可勾選的開關，映射成 Fact.usage。 */
export interface KnowledgeBaseCommitItemInput {
  id: string;
  label: string;
  content: string;
  tags: string[];
  volatility: "high" | "low";
  internal: boolean;
}

function documentRowToFile(row: DocumentRow): KnowledgeBaseFile {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    pageCount: row.pageCount,
    status: row.status,
    errorReason: row.errorReason,
  };
}

function baseRowToSummary(row: BaseRow, files: KnowledgeBaseFile[]): KnowledgeBaseSummary {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    fileCount: files.length,
    files,
    createdAt: row.createdAt.toISOString(),
    errorReason: row.errorReason,
  };
}

/**
 * 知識庫層的 draft＝底下所有文件 extracted_draft 的合併：
 * 任一文件抽到東西就是 extracted:true（items 依文件順序串接）；
 * 全部都抽不到（或失敗）就把 reason 併起來回 extracted:false；完全沒有草稿回 null。
 */
export function mergeDrafts(documents: DocumentRow[]): ExtractedDraft | null {
  const drafts = documents
    .map(row => row.extractedDraft as ExtractedDraft | null)
    .filter((draft): draft is ExtractedDraft => draft !== null);
  if (drafts.length === 0) {
    return null;
  }

  const items: ExtractedFactItem[] = drafts.flatMap(draft => (draft.extracted ? draft.items : []));
  if (drafts.some(draft => draft.extracted)) {
    return { extracted: true, items };
  }
  const reason = drafts
    .map(draft => (draft.extracted ? "" : draft.reason))
    .filter(text => text.length > 0)
    .join("；");
  return { extracted: false, reason };
}

export interface KnowledgeBaseRepository {
  createBase: (name?: string) => Promise<{ id: string }>;
  addDocument: (baseId: string, input: KnowledgeBaseFileInput) => Promise<{ id: string }>;
  markDocumentExtracted: (documentId: string, pageCount: number, draft: ExtractedDraft) => Promise<void>;
  markDocumentFailed: (documentId: string, reason: string, pageCount?: number) => Promise<void>;
  /** 上傳流程結束時把知識庫從 extracting 收斂成 draft 或 failed。 */
  finalizeBase: (baseId: string, status: "draft" | "failed", errorReason?: string) => Promise<void>;
  list: () => Promise<KnowledgeBaseSummary[]>;
  getById: (id: string) => Promise<KnowledgeBaseDetail | undefined>;
  /** 單一 transaction 內批次 upsert facts（掛 knowledge_base_id）並把知識庫狀態改成 committed。 */
  commit: (id: string, items: KnowledgeBaseCommitItemInput[]) => Promise<Fact[]>;
  /** 刪知識庫；documents 與 commit 出來的 facts 由 FK CASCADE 連動刪除。 */
  remove: (id: string) => Promise<boolean>;
}

export class DbKnowledgeBaseStore implements KnowledgeBaseRepository {
  constructor(private readonly db: AnyPgDatabase) {}

  async createBase(name?: string): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(basesTable)
      .values({ name: name ?? null, status: "extracting" })
      .returning({ id: basesTable.id });
    return row;
  }

  async addDocument(baseId: string, input: KnowledgeBaseFileInput): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(documentsTable)
      .values({
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        knowledgeBaseId: baseId,
        status: "parsing",
      })
      .returning({ id: documentsTable.id });
    return row;
  }

  async markDocumentExtracted(documentId: string, pageCount: number, draft: ExtractedDraft): Promise<void> {
    await this.db
      .update(documentsTable)
      .set({ status: "extracted", pageCount, extractedDraft: draft, errorReason: null })
      .where(eq(documentsTable.id, documentId));
  }

  async markDocumentFailed(documentId: string, reason: string, pageCount?: number): Promise<void> {
    await this.db
      .update(documentsTable)
      .set({ status: "failed", errorReason: reason, ...(pageCount === undefined ? {} : { pageCount }) })
      .where(eq(documentsTable.id, documentId));
  }

  async finalizeBase(baseId: string, status: "draft" | "failed", errorReason?: string): Promise<void> {
    await this.db
      .update(basesTable)
      .set({ status, errorReason: errorReason ?? null, updatedAt: new Date() })
      .where(eq(basesTable.id, baseId));
  }

  async list(): Promise<KnowledgeBaseSummary[]> {
    const baseRows = await this.db.select().from(basesTable).orderBy(desc(basesTable.createdAt));
    if (baseRows.length === 0) {
      return [];
    }
    const documentRows = await this.db
      .select()
      .from(documentsTable)
      .where(inArray(documentsTable.knowledgeBaseId, baseRows.map(row => row.id)))
      .orderBy(documentsTable.createdAt);

    return baseRows.map(row => baseRowToSummary(
      row,
      documentRows.filter(doc => doc.knowledgeBaseId === row.id).map(documentRowToFile),
    ));
  }

  async getById(id: string): Promise<KnowledgeBaseDetail | undefined> {
    if (!isValidBaseId(id)) {
      return undefined;
    }
    const [row] = await this.db.select().from(basesTable).where(eq(basesTable.id, id));
    if (!row) {
      return undefined;
    }
    const documentRows = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.knowledgeBaseId, id))
      .orderBy(documentsTable.createdAt);

    return {
      ...baseRowToSummary(row, documentRows.map(documentRowToFile)),
      draft: mergeDrafts(documentRows),
    };
  }

  /**
   * `_TODO` 前綴檢查故意放在 transaction 迴圈「裡面」：前面已成功的項目跟著失敗
   * 一起 rollback，不留半套資料。id 衝突檢查放在迴圈「外面」先掃一輪：id 是使用者
   * 可編輯欄位，若已存在且不屬於這個知識庫（含手動維護的 fact），無條件覆蓋會
   * 靜默蓋掉別人的知識——先掃全部擋下來回 409。同一個知識庫重複 commit（更新
   * 自己先前產生的 facts）仍然允許。
   */
  async commit(id: string, items: KnowledgeBaseCommitItemInput[]): Promise<Fact[]> {
    return this.db.transaction(async (tx) => {
      if (items.length > 0) {
        const ids = items.map(item => item.id);
        const existingRows = await tx
          .select({ id: factsTable.id, knowledgeBaseId: factsTable.knowledgeBaseId })
          .from(factsTable)
          .where(inArray(factsTable.id, ids));

        const conflictingIds = existingRows
          .filter(row => row.knowledgeBaseId !== id)
          .map(row => row.id);

        if (conflictingIds.length > 0) {
          throw new ConflictError(
            `以下 id 已存在且不屬於這個知識庫，請改用其他 id：${conflictingIds.join(", ")}`,
          );
        }
      }

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
          knowledgeBaseId: id,
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
            knowledgeBaseId: id,
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
              knowledgeBaseId: id,
              updatedAt,
            },
          })
          .returning();

        results.push(factRowToFact(row));
      }

      await tx.update(basesTable).set({ status: "committed", updatedAt: new Date() }).where(eq(basesTable.id, id));
      // 只有抽取成功的檔標 committed；failed 的檔保持 failed 讓 app 仍看得到哪些檔沒進來
      await tx
        .update(documentsTable)
        .set({ status: "committed" })
        .where(and(eq(documentsTable.knowledgeBaseId, id), eq(documentsTable.status, "extracted")));

      return results;
    });
  }

  async remove(id: string): Promise<boolean> {
    if (!isValidBaseId(id)) {
      return false;
    }
    const deleted = await this.db
      .delete(basesTable)
      .where(eq(basesTable.id, id))
      .returning({ id: basesTable.id });
    return deleted.length > 0;
  }
}
