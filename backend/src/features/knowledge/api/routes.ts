import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import { ContactSchema, FactSchema } from "@/shared/knowledge";

import {
  ContactListResponseSchema,
  ContactPutBodySchema,
  FactListResponseSchema,
  FactPutBodySchema,
  KnowledgeIdParamsSchema,
} from "../validation/knowledge.schema";

const contactsTags = ["Contacts"];
const factsTags = ["Facts"];

export const listContacts = createRoute({
  method: "get",
  path: "/contacts",
  tags: contactsTags,
  operationId: "listContacts",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ContactListResponseSchema, "全部對象檔案（不含 _TODO 骨架筆）"),
  },
});

export const upsertContact = createRoute({
  method: "put",
  path: "/contacts/{id}",
  tags: contactsTags,
  operationId: "upsertContact",
  request: {
    params: KnowledgeIdParamsSchema,
    body: jsonContentRequired(ContactPutBodySchema, "對象檔案內容（不含 id）"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(ContactSchema, "新增或更新後的對象檔案"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("id 不可為保留前綴 _TODO"),
      "id 不合法",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(ContactPutBodySchema),
      "驗證錯誤",
    ),
  },
});

export const deleteContact = createRoute({
  method: "delete",
  path: "/contacts/{id}",
  tags: contactsTags,
  operationId: "deleteContact",
  request: {
    params: KnowledgeIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "已刪除" },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到對象檔案"),
      "id 不存在",
    ),
  },
});

export const listFacts = createRoute({
  method: "get",
  path: "/facts",
  tags: factsTags,
  operationId: "listFacts",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(FactListResponseSchema, "全部事實庫（不含 _TODO 骨架筆）"),
  },
});

export const upsertFact = createRoute({
  method: "put",
  path: "/facts/{id}",
  tags: factsTags,
  operationId: "upsertFact",
  request: {
    params: KnowledgeIdParamsSchema,
    body: jsonContentRequired(FactPutBodySchema, "事實內容（不含 id；updatedAt 省略時後端補今天日期）"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(FactSchema, "新增或更新後的事實"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("id 不可為保留前綴 _TODO"),
      "id 不合法",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(FactPutBodySchema),
      "驗證錯誤",
    ),
  },
});

export const deleteFact = createRoute({
  method: "delete",
  path: "/facts/{id}",
  tags: factsTags,
  operationId: "deleteFact",
  request: {
    params: KnowledgeIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "已刪除" },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到事實"),
      "id 不存在",
    ),
  },
});

export type ListContactsRoute = typeof listContacts;
export type UpsertContactRoute = typeof upsertContact;
export type DeleteContactRoute = typeof deleteContact;
export type ListFactsRoute = typeof listFacts;
export type UpsertFactRoute = typeof upsertFact;
export type DeleteFactRoute = typeof deleteFact;
