import { z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";

import { projects as projectsTable } from "@/db/schema";

import type { AnyPgDatabase } from "./store";

/**
 * 專案（知識庫的父層實體，對應 Android app-settings「每個知識庫以專案為單位」）。
 * facts／contacts／knowledge_documents 以 project_id 掛在專案底下；
 * 刪除專案時底下資料保留但 project_id 變 null（FK ON DELETE SET NULL）。
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * projects.id 是 uuid 欄位——非 uuid 格式的字串直接打 DB 會在型別轉換階段丟錯（500），
 * 呼叫端想要的其實是「查無此專案」（404），所以先擋掉、一律當「不存在」處理。
 * （同 document-store.ts 的 isValidDocumentId。）
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidProjectId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

type ProjectRow = typeof projectsTable.$inferSelect;

function projectRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface ProjectRepository {
  list: () => Promise<Project[]>;
  create: (name: string) => Promise<Project>;
  rename: (id: string, name: string) => Promise<Project | undefined>;
  remove: (id: string) => Promise<boolean>;
}

export class DbProjectStore implements ProjectRepository {
  constructor(private readonly db: AnyPgDatabase) {}

  async list(): Promise<Project[]> {
    const rows = await this.db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
    return rows.map(projectRowToProject);
  }

  async create(name: string): Promise<Project> {
    const [row] = await this.db.insert(projectsTable).values({ name }).returning();
    return projectRowToProject(row);
  }

  async rename(id: string, name: string): Promise<Project | undefined> {
    if (!isValidProjectId(id)) {
      return undefined;
    }
    const [row] = await this.db
      .update(projectsTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();
    return row ? projectRowToProject(row) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    if (!isValidProjectId(id)) {
      return false;
    }
    const deleted = await this.db
      .delete(projectsTable)
      .where(eq(projectsTable.id, id))
      .returning({ id: projectsTable.id });
    return deleted.length > 0;
  }
}
