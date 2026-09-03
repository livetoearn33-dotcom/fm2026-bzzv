import type { LiveKnowledgeStore } from "@/shared/knowledge";

import { createRouter } from "@/lib/create-app";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createKnowledgeRouter(store: LiveKnowledgeStore) {
  return createRouter()
    .openapi(routes.listContacts, handlers.createListContactsHandler(store))
    .openapi(routes.upsertContact, handlers.createUpsertContactHandler(store))
    .openapi(routes.deleteContact, handlers.createDeleteContactHandler(store))
    .openapi(routes.listFacts, handlers.createListFactsHandler(store))
    .openapi(routes.upsertFact, handlers.createUpsertFactHandler(store))
    .openapi(routes.deleteFact, handlers.createDeleteFactHandler(store));
}
