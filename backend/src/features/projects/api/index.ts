import type { ProjectRepository } from "@/shared/knowledge";

import { createRouter } from "@/lib/create-app";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createProjectsRouter(store: ProjectRepository) {
  return createRouter()
    .openapi(routes.listProjects, handlers.createListProjectsHandler(store))
    .openapi(routes.createProject, handlers.createCreateProjectHandler(store))
    .openapi(routes.renameProject, handlers.createRenameProjectHandler(store))
    .openapi(routes.deleteProject, handlers.createDeleteProjectHandler(store));
}
