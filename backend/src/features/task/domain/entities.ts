/**
 * Task 領域層
 *
 * 定義 Repository 介面、Service 介面、領域行為和領域常數。
 * 資料結構型別從 types/ 匯入，不在此重複定義。
 */

import type { Task, TaskInsert, TaskUpdate } from "../types";

// ============================================================
// 領域常數
// ============================================================

/**
 * 任務名稱限制
 */
export const TASK_NAME_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 500,
} as const;

// ============================================================
// Repository 介面（Domain 定義需要什麼）
// ============================================================

/**
 * Task 儲存庫介面
 * 定義資料存取層的契約
 */
export interface TaskRepository {
  findAll: () => Promise<Task[]>;
  findById: (id: number) => Promise<Task | null>;
  create: (data: TaskInsert) => Promise<Task>;
  update: (id: number, data: TaskUpdate) => Promise<Task | null>;
  delete: (id: number) => Promise<boolean>;
}

// ============================================================
// Service 依賴介面
// ============================================================

/**
 * 服務層依賴
 */
export interface TaskServiceDeps {
  taskRepository: TaskRepository;
}

// ============================================================
// Service 函式型別
// ============================================================

export type ListTasksFn = () => Promise<Task[]>;
export type GetTaskFn = (id: number) => Promise<Task>;
export type CreateTaskFn = (data: TaskInsert) => Promise<Task>;
export type UpdateTaskFn = (id: number, data: TaskUpdate) => Promise<Task>;
export type DeleteTaskFn = (id: number) => Promise<void>;
