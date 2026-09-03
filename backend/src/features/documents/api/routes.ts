import { createRoute } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createErrorSchema, createMessageObjectSchema } from "stoker/openapi/schemas";

import {
  DocumentCommitBodySchema,
  DocumentCommitResponseSchema,
  DocumentDetailResponseSchema,
  DocumentIdParamsSchema,
  DocumentListResponseSchema,
  UploadDocumentBodySchema,
  UploadDocumentResponseSchema,
} from "../validation/documents.schema";

const tags = ["Knowledge Documents"];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const uploadBodyLimit = bodyLimit({
  maxSize: MAX_UPLOAD_BYTES,
  onError: c => c.json({ message: "檔案超過 10MB 上限" }, HttpStatusCodes.REQUEST_TOO_LONG),
});

export const uploadDocument = createRoute({
  method: "post",
  path: "/knowledge/documents",
  tags,
  operationId: "uploadKnowledgeDocument",
  middleware: [uploadBodyLimit] as const,
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": { schema: UploadDocumentBodySchema },
      },
    },
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(UploadDocumentResponseSchema, "解析＋LLM 抽取結果（草稿，尚未寫入知識庫）"),
    [HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE]: jsonContent(
      createMessageObjectSchema("只接受 PDF 檔案"),
      "上傳的不是 PDF",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createMessageObjectSchema("這份 PDF 讀不到可抽取的文字內容，可能是掃描檔或純圖片"),
      "PDF 讀不到可抽取的文字內容（掃描檔／純圖）",
    ),
    [HttpStatusCodes.REQUEST_TOO_LONG]: jsonContent(
      createMessageObjectSchema("檔案超過 10MB 上限"),
      "檔案過大",
    ),
    [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
      createMessageObjectSchema("LLM 呼叫失敗或回傳不符 schema"),
      "上游 LLM 錯誤",
    ),
  },
});

export const listDocuments = createRoute({
  method: "get",
  path: "/knowledge/documents",
  tags,
  operationId: "listKnowledgeDocuments",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(DocumentListResponseSchema, "全部已上傳文件（不含 extracted_draft 全文）"),
  },
});

export const getDocument = createRoute({
  method: "get",
  path: "/knowledge/documents/{id}",
  tags,
  operationId: "getKnowledgeDocument",
  request: {
    params: DocumentIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(DocumentDetailResponseSchema, "文件狀態與抽取草稿"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識文件"),
      "id 不存在",
    ),
  },
});

export const commitDocument = createRoute({
  method: "post",
  path: "/knowledge/documents/{id}/commit",
  tags,
  operationId: "commitKnowledgeDocument",
  request: {
    params: DocumentIdParamsSchema,
    body: jsonContentRequired(DocumentCommitBodySchema, "使用者確認／編輯過的草稿條目"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(DocumentCommitResponseSchema, "寫入知識庫後的 facts"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("id 不可為保留前綴 _TODO"),
      "id 不合法",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識文件"),
      "id 不存在",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(DocumentCommitBodySchema),
      "驗證錯誤",
    ),
  },
});

export const deleteDocument = createRoute({
  method: "delete",
  path: "/knowledge/documents/{id}",
  tags,
  operationId: "deleteKnowledgeDocument",
  request: {
    params: DocumentIdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "已刪除。已 commit 的 facts 因 FK ON DELETE SET NULL 會保留但失去溯源（source_document_id 變 null）——這是預期行為。",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("找不到知識文件"),
      "id 不存在",
    ),
  },
});

export type UploadDocumentRoute = typeof uploadDocument;
export type ListDocumentsRoute = typeof listDocuments;
export type GetDocumentRoute = typeof getDocument;
export type CommitDocumentRoute = typeof commitDocument;
export type DeleteDocumentRoute = typeof deleteDocument;
