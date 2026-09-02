import { createRouter } from "@/lib/create-app";

import type { TaskServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createTaskRouter(services: TaskServices) {
  const router = createRouter()
    .openapi(routes.list, handlers.createListHandler(services))
    .openapi(routes.create, handlers.createCreateHandler(services))
    .openapi(routes.getOne, handlers.createGetOneHandler(services))
    .openapi(routes.patch, handlers.createPatchHandler(services))
    .openapi(routes.remove, handlers.createRemoveHandler(services));

  return router;
}
