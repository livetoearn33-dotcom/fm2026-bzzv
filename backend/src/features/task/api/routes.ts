import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

import { notFoundSchema } from "@/shared/utils";

import { TaskInsertSchema, TaskSelectSchema, TaskUpdateSchema } from "../validation/task.schema";

const tags = ["Tasks"];

export const list = createRoute({
  method: "get",
  path: "/tasks",
  tags,
  operationId: "listTasks",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(TaskSelectSchema),
      "任務列表",
    ),
  },
});

export const create = createRoute({
  method: "post",
  path: "/tasks",
  tags,
  operationId: "createTask",
  request: {
    body: jsonContentRequired(
      TaskInsertSchema,
      "任務建立資料",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      TaskSelectSchema,
      "任務建立成功",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(TaskInsertSchema),
      "驗證錯誤",
    ),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/tasks/{id}",
  tags,
  operationId: "getTask",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      TaskSelectSchema,
      "任務詳情",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "找不到任務",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "無效的 ID 錯誤",
    ),
  },
});

export const patch = createRoute({
  method: "patch",
  path: "/tasks/{id}",
  tags,
  operationId: "updateTask",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      TaskUpdateSchema,
      "任務更新資料",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      TaskSelectSchema,
      "任務更新成功",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "找不到任務",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(TaskUpdateSchema)
        .or(createErrorSchema(IdParamsSchema)),
      "驗證錯誤",
    ),
  },
});

export const remove = createRoute({
  method: "delete",
  path: "/tasks/{id}",
  tags,
  operationId: "deleteTask",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "任務刪除成功",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      notFoundSchema,
      "找不到任務",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "無效的 ID 錯誤",
    ),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
