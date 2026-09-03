import * as HttpStatusCodes from "stoker/http-status-codes";

import type { KnowledgeRepository } from "@/shared/knowledge";
import type { AppRouteHandler } from "@/shared/types";

import { ValidationError } from "@/shared/errors";

import type {
  DeleteContactRoute,
  DeleteFactRoute,
  ListContactsRoute,
  ListFactsRoute,
  UpsertContactRoute,
  UpsertFactRoute,
} from "./routes";

export function createListContactsHandler(store: KnowledgeRepository): AppRouteHandler<ListContactsRoute> {
  return async (c) => {
    return c.json(await store.listContacts(), HttpStatusCodes.OK);
  };
}

export function createUpsertContactHandler(store: KnowledgeRepository): AppRouteHandler<UpsertContactRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const contact = await store.upsertContact(id, body);
      return c.json(contact, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      throw error;
    }
  };
}

export function createDeleteContactHandler(store: KnowledgeRepository): AppRouteHandler<DeleteContactRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await store.deleteContact(id);
    if (!deleted) {
      return c.json({ message: `找不到對象檔案：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  };
}

export function createListFactsHandler(store: KnowledgeRepository): AppRouteHandler<ListFactsRoute> {
  return async (c) => {
    return c.json(await store.listFacts(), HttpStatusCodes.OK);
  };
}

export function createUpsertFactHandler(store: KnowledgeRepository): AppRouteHandler<UpsertFactRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const fact = await store.upsertFact(id, body);
      return c.json(fact, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof ValidationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      throw error;
    }
  };
}

export function createDeleteFactHandler(store: KnowledgeRepository): AppRouteHandler<DeleteFactRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await store.deleteFact(id);
    if (!deleted) {
      return c.json({ message: `找不到事實：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  };
}
