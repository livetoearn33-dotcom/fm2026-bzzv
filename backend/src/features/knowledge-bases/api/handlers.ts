import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/shared/types";

import { AppError, ConflictError, NotFoundError, ValidationError } from "@/shared/errors";

import type { KnowledgeBaseServices } from "../services";
import type {
  CommitKnowledgeBaseRoute,
  CreateKnowledgeBaseRoute,
  DeleteKnowledgeBaseRoute,
  GetKnowledgeBaseRoute,
  ListKnowledgeBasesRoute,
} from "./routes";

export function createCreateKnowledgeBaseHandler(services: KnowledgeBaseServices): AppRouteHandler<CreateKnowledgeBaseRoute> {
  return async (c) => {
    const { files, name, internal } = c.req.valid("form");

    try {
      const result = await services.createKnowledgeBase(files, { name, internal });
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (error) {
      // 全部檔案都失敗時，service 丟出第一個檔的錯誤（AppError 子類，自帶正確狀態碼
      // 415/413/400/422/502）；ValidationError（如 files 為空）也走同一條路回 400。
      if (error instanceof AppError) {
        return c.json({ message: error.message }, error.statusCode as 400);
      }
      throw error;
    }
  };
}

export function createListKnowledgeBasesHandler(services: KnowledgeBaseServices): AppRouteHandler<ListKnowledgeBasesRoute> {
  return async (c) => {
    return c.json(await services.listKnowledgeBases(), HttpStatusCodes.OK);
  };
}

export function createGetKnowledgeBaseHandler(services: KnowledgeBaseServices): AppRouteHandler<GetKnowledgeBaseRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const base = await services.getKnowledgeBase(id);
    if (!base) {
      return c.json({ message: `找不到知識庫：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(base, HttpStatusCodes.OK);
  };
}

export function createCommitKnowledgeBaseHandler(services: KnowledgeBaseServices): AppRouteHandler<CommitKnowledgeBaseRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { items } = c.req.valid("json");

    try {
      const result = await services.commitKnowledgeBase(id, items);
      return c.json(result, HttpStatusCodes.OK);
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

export function createDeleteKnowledgeBaseHandler(services: KnowledgeBaseServices): AppRouteHandler<DeleteKnowledgeBaseRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await services.deleteKnowledgeBase(id);
    if (!deleted) {
      return c.json({ message: `找不到知識庫：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  };
}
