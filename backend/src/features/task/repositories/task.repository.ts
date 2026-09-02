import { eq } from "drizzle-orm";

import type db from "@/db";

import type { TaskRepository } from "../domain/entities";
import type { TaskInsert, TaskUpdate } from "../types";

import { tasksTable } from "../db/schema";

type Db = typeof db;

export function createTaskRepository(db: Db): TaskRepository {
  const findAll = async () => {
    return await db.query.tasksTable.findMany();
  };

  const findById = async (id: number) => {
    const result = await db.query.tasksTable.findFirst({
      where: (fields, operators) => operators.eq(fields.id, id),
    });

    return result ?? null;
  };

  const create = async (data: TaskInsert) => {
    // 明確只傳入 name 和 done，避免 id 被設為 null
    const { name, done } = data;
    const [inserted] = await db.insert(tasksTable).values({ name, done }).returning();

    return inserted!;
  };

  const update = async (id: number, data: TaskUpdate) => {
    const [updated] = await db
      .update(tasksTable)
      .set(data)
      .where(eq(tasksTable.id, id))
      .returning();

    return updated ?? null;
  };

  const deleteFn = async (id: number) => {
    const result = await db.delete(tasksTable).where(eq(tasksTable.id, id));

    return (result.rowCount ?? 0) > 0;
  };

  return {
    findAll,
    findById,
    create,
    update,
    delete: deleteFn,
  };
}
