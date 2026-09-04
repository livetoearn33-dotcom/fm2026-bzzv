import { createRoute } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import {
  CreateKnowledgeBaseBodySchema,
  CreateKnowledgeBaseResponseSchema,
  KnowledgeBaseCommitBodySchema,
  KnowledgeBaseCommitResponseSchema,
  KnowledgeBaseDetailResponseSchema,
  KnowledgeBaseIdParamsSchema,
  KnowledgeBaseListResponseSchema,
} from "../validation/knowledge-bases.schema";

const tags = ["Knowledge Bases"];

/** 單檔上限 10MB 在 service 逐檔檢查（跳過壞檔語意）；這裡擋的是整個 multipart request 的總量。 */
const MAX_REQUEST_BYTES = 60 * 1024 * 1024;

const uploadBodyLimit = bodyLimit({
  maxSize: MAX_REQUEST_BYTES,
  onError: c => c.json({ message: "上傳總量超過 60MB 上限" }, HttpStatusCodes.REQUEST_TOO_LONG),
});

export const listKnowledgeBases = createRoute({
  method: "get",
  path: "/knowledge-bases",
  tags,
  operationId: "listKnowledgeBases",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(KnowledgeBaseListResponseSchema, "全部知識庫（新→舊），app 首頁唯一資料來源"),
  },
});

export const createKnowledgeBase = createRoute({
  method: "post",
  path: "/knowledge-bases",
  tags,
  operationId: "createKnowledgeBase",
  middleware: [uploadBodyLimit] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": { schema: CreateKnowledgeBaseBodySchema },
      },
    },
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      CreateKnowledgeBaseResponseSchema,
      "解析＋LLM 抽取結果（草稿，尚未寫入知識庫）。單一壞檔會標 failed 跳過，全部檔案失敗才回錯誤狀態碼。",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("PDF 檔案讀取失敗"),
      "所有檔案都毀損或根本不是 PDF",
    ),
    [HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE]: jsonContent(
      createMessageObjectSchema("只接受 PDF 檔案"),
      "所有檔案都不是 PDF",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(CreateKnowledgeBaseBodySchema),
      "驗證錯誤，或所有 PDF 都讀不到可抽取的文字（掃描檔／純圖）",
    ),
    [HttpStatusCodes.REQUEST_TOO_LONG]: jsonContent(
      createMessageObjectSchema("檔案超過 10MB 上限"),
      "所有檔案都過大，或上傳總量超過 60MB",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "所有檔案都在 LLM 抽取階段失敗",
    ),
  },
});

export const getKnowledgeBase = createRoute({
  method: "get",
  path: "/knowledge-bases/{id}",
  tags,
  operationId: "getKnowledgeBase",
  request: {
    params: KnowledgeBaseIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(KnowledgeBaseDetailResponseSchema, "知識庫狀態與合併後的抽取草稿（重開未 commit 的知識庫用）"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識庫"),
      "id 不存在",
    ),
  },
});

export const commitKnowledgeBase = createRoute({
  method: "post",
  path: "/knowledge-bases/{id}/commit",
  tags,
  operationId: "commitKnowledgeBase",
  request: {
    params: KnowledgeBaseIdParamsSchema,
    body: jsonContentRequired(KnowledgeBaseCommitBodySchema, "使用者確認／編輯過的草稿條目"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      KnowledgeBaseCommitResponseSchema,
      "寫入知識庫後的結果；只有這一步成功後知識才正式進 facts / RAG",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("id 不可為保留前綴 _TODO"),
      "id 不合法",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識庫"),
      "id 不存在",
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      createMessageObjectSchema("以下 id 已存在且不屬於這個知識庫"),
      "commit body 的 id 撞到別的知識庫或手動維護的既有 fact",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(KnowledgeBaseCommitBodySchema),
      "驗證錯誤",
    ),
  },
});

export const deleteKnowledgeBase = createRoute({
  method: "delete",
  path: "/knowledge-bases/{id}",
  tags,
  operationId: "deleteKnowledgeBase",
  request: {
    params: KnowledgeBaseIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "已刪除。關聯 documents 與這個知識庫 commit 出來的 facts 一併刪除（之後不再被 RAG 引用）；手動維護的 facts 不受影響。",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識庫"),
      "id 不存在",
    ),
  },
});

export type ListKnowledgeBasesRoute = typeof listKnowledgeBases;
export type CreateKnowledgeBaseRoute = typeof createKnowledgeBase;
export type GetKnowledgeBaseRoute = typeof getKnowledgeBase;
export type CommitKnowledgeBaseRoute = typeof commitKnowledgeBase;
export type DeleteKnowledgeBaseRoute = typeof deleteKnowledgeBase;
