import { createRouter } from "@/lib/create-app";

import type { DocumentServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createDocumentsRouter(services: DocumentServices) {
  return createRouter()
    .openapi(routes.uploadDocument, handlers.createUploadDocumentHandler(services))
    .openapi(routes.listDocuments, handlers.createListDocumentsHandler(services))
    .openapi(routes.getDocument, handlers.createGetDocumentHandler(services))
    .openapi(routes.commitDocument, handlers.createCommitDocumentHandler(services))
    .openapi(routes.deleteDocument, handlers.createDeleteDocumentHandler(services));
}
