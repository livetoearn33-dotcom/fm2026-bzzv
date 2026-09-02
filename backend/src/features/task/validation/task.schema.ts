/**
 * Task API 驗證結構描述
 *
 * 基於 types/ 的共享型別建立 API 驗證規則
 */

import type { z } from "@hono/zod-openapi";

import { toZodV4SchemaTyped } from "@/shared/utils";

import { TASK_NAME_CONSTRAINTS } from "../domain/entities";
import { TaskInsertSchemaBase, TaskSchema } from "../types";

// ============================================================
// API 驗證 Schema
// ============================================================

export const TaskSelectSchema = toZodV4SchemaTyped(TaskSchema);

export const TaskInsertSchema = toZodV4SchemaTyped(
  TaskInsertSchemaBase
    .omit({ id: true, createdAt: true, updatedAt: true })
    .required({ done: true })
    .extend({
      name: TaskInsertSchemaBase.shape.name
        .min(TASK_NAME_CONSTRAINTS.MIN_LENGTH)
        .max(TASK_NAME_CONSTRAINTS.MAX_LENGTH),
    }),
);

export const TaskUpdateSchema = toZodV4SchemaTyped(
  TaskInsertSchemaBase
    .omit({ id: true, createdAt: true, updatedAt: true })
    .extend({
      name: TaskInsertSchemaBase.shape.name
        .min(TASK_NAME_CONSTRAINTS.MIN_LENGTH)
        .max(TASK_NAME_CONSTRAINTS.MAX_LENGTH),
    })
    .partial(),
);

// ============================================================
// 型別匯出（從 schema 推導）
// ============================================================

export type TaskSelect = z.infer<typeof TaskSelectSchema>;
export type TaskInsert = z.infer<typeof TaskInsertSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
