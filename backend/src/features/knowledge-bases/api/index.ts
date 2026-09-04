import { createRouter } from "@/lib/create-app";

import type { KnowledgeBaseServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createKnowledgeBasesRouter(services: KnowledgeBaseServices) {
  return createRouter()
    .openapi(routes.listKnowledgeBases, handlers.createListKnowledgeBasesHandler(services))
    .openapi(routes.createKnowledgeBase, handlers.createCreateKnowledgeBaseHandler(services))
    .openapi(routes.getKnowledgeBase, handlers.createGetKnowledgeBaseHandler(services))
    .openapi(routes.commitKnowledgeBase, handlers.createCommitKnowledgeBaseHandler(services))
    .openapi(routes.deleteKnowledgeBase, handlers.createDeleteKnowledgeBaseHandler(services));
}
