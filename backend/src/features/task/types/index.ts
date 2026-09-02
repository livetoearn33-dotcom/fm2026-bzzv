/**
 * Task 共享型別層（Single Source of Truth）
 *
 * 所有型別從 Drizzle schema 推導，禁止手動重複定義。
 * 其他層（domain、validation、services、repositories）應從此處匯入型別。
 */

import type { z } from "@hono/zod-openapi";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { tasksTable } from "../db/schema";

// ============================================================
// 從 Drizzle schema 推導基礎 Schema（保持原始型別以支援 omit 等方法）
// ============================================================

export const TaskSchema = createSelectSchema(tasksTable);
export const TaskInsertSchemaBase = createInsertSchema(tasksTable);

// ============================================================
// 匯出推導的 TypeScript 型別
// ============================================================

/** Task 實體型別（從 DB schema 推導） */
export type Task = z.infer<typeof TaskSchema>;

/** Task 新增資料型別（從 DB schema 推導，含 optional 欄位） */
export type TaskInsertBase = z.infer<typeof TaskInsertSchemaBase>;

/** Task 建立資料型別（必填欄位：name, done） */
export type TaskInsert = Pick<TaskInsertBase, "name"> & { done: boolean };

/** Task 更新資料型別（部分欄位） */
export type TaskUpdate = Partial<Pick<TaskInsertBase, "name" | "done">>;
