import { z } from "@hono/zod-openapi";

/**
 * 事實庫（data/facts.json）單筆 schema。
 * 欄位定義見 data/README-知識庫.md。
 */
export const FactSchema = z.object({
  id: z.string(),
  label: z.string(),
  tags: z.array(z.string()),
  content: z.string(),
  updatedAt: z.string(),
  volatility: z.enum(["high", "low"]),
  /** "internal" = AI 可參考、絕不能寫進回覆／sources；省略＝可引用 */
  usage: z.enum(["internal"]).optional(),
  /** 所屬知識庫 id（見 /v1/knowledge-bases）；commit 時寫入，刪知識庫連動刪除。省略＝手動維護的知識 */
  knowledgeBaseId: z.string().uuid().optional(),
});

export type Fact = z.infer<typeof FactSchema>;

/**
 * 對象檔案（data/contacts.json）單筆 schema。
 */
export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  tone: z.string(),
  notes: z.string(),
  recentTopics: z.array(z.string()),
  /** 所屬知識庫 id（見 /v1/knowledge-bases）；省略＝未歸屬。刪知識庫只脫鉤不刪除 */
  knowledgeBaseId: z.string().uuid().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;

export interface KnowledgeStore {
  facts: Fact[];
  contacts: Contact[];
}
