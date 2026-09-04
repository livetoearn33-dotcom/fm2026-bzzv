import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/shared/types";

import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";

import type { DocumentServices } from "../services";
import type {
  CommitDocumentRoute,
  DeleteDocumentRoute,
  GetDocumentRoute,
  ListDocumentsRoute,
  UploadDocumentRoute,
} from "./routes";

import { DocumentExtractionError, InvalidPdfError, UnextractableContentError, UnsupportedFileTypeError } from "../domain/errors";

export function createUploadDocumentHandler(services: DocumentServices): AppRouteHandler<UploadDocumentRoute> {
  return async (c) => {
    const { file, projectId } = c.req.valid("form");

    try {
      const result = await services.uploadDocument(file, projectId);
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof UnsupportedFileTypeError) {
        return c.json({ message: error.message }, HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE);
      }
      if (error instanceof InvalidPdfError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      // projectId 帶了但專案不存在（見 DbKnowledgeDocumentStore.create 的 assertProjectExists）
      if (error instanceof ValidationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      if (error instanceof UnextractableContentError) {
        return c.json({ message: error.message }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
      }
      if (error instanceof DocumentExtractionError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_GATEWAY);
      }
      throw error;
    }
  };
}

export function createListDocumentsHandler(services: DocumentServices): AppRouteHandler<ListDocumentsRoute> {
  return async (c) => {
    return c.json(await services.listDocuments(), HttpStatusCodes.OK);
  };
}

export function createGetDocumentHandler(services: DocumentServices): AppRouteHandler<GetDocumentRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const document = await services.getDocument(id);
    if (!document) {
      return c.json({ message: `找不到知識文件：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(document, HttpStatusCodes.OK);
  };
}

export function createCommitDocumentHandler(services: DocumentServices): AppRouteHandler<CommitDocumentRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { items } = c.req.valid("json");

    try {
      const facts = await services.commitDocument(id, items);
      return c.json(facts, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof NotFoundError) {
        return c.json({ message: error.message }, HttpStatusCodes.NOT_FOUND);
      }
      if (error instanceof ValidationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      if (error instanceof ConflictError) {
        return c.json({ message: error.message }, HttpStatusCodes.CONFLICT);
      }
      throw error;
    }
  };
}

export function createDeleteDocumentHandler(services: DocumentServices): AppRouteHandler<DeleteDocumentRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await services.deleteDocument(id);
    if (!deleted) {
      return c.json({ message: `找不到知識文件：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  };
}
