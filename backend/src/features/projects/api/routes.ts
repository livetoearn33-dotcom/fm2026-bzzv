import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { ProjectSchema } from "@/shared/knowledge";

import {
  ProjectBodySchema,
  ProjectIdParamsSchema,
  ProjectListResponseSchema,
} from "../validation/projects.schema";

const tags = ["Projects"];

export const listProjects = createRoute({
  method: "get",
  path: "/projects",
  tags,
  operationId: "listProjects",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectListResponseSchema, "全部專案（新→舊）"),
  },
});

export const createProject = createRoute({
  method: "post",
  path: "/projects",
  tags,
  operationId: "createProject",
  request: {
    body: jsonContentRequired(ProjectBodySchema, "專案名稱"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(ProjectSchema, "建立後的專案（id 由後端生成）"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(ProjectBodySchema),
      "驗證錯誤",
    ),
  },
});

export const renameProject = createRoute({
  method: "put",
  path: "/projects/{id}",
  tags,
  operationId: "renameProject",
  request: {
    params: ProjectIdParamsSchema,
    body: jsonContentRequired(ProjectBodySchema, "新的專案名稱"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ProjectSchema, "更新後的專案"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到專案"),
      "id 不存在",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(ProjectBodySchema),
      "驗證錯誤",
    ),
  },
});

export const deleteProject = createRoute({
  method: "delete",
  path: "/projects/{id}",
  tags,
  operationId: "deleteProject",
  request: {
    params: ProjectIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "已刪除。底下的 facts／contacts／knowledge_documents 保留但脫鉤（project_id 變 null，FK ON DELETE SET NULL）。",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到專案"),
      "id 不存在",
    ),
  },
});

export type ListProjectsRoute = typeof listProjects;
export type CreateProjectRoute = typeof createProject;
export type RenameProjectRoute = typeof renameProject;
export type DeleteProjectRoute = typeof deleteProject;
