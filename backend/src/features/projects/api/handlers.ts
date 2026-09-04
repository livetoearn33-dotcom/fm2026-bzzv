import * as HttpStatusCodes from "stoker/http-status-codes";

import type { ProjectRepository } from "@/shared/knowledge";
import type { AppRouteHandler } from "@/shared/types";

import type {
  CreateProjectRoute,
  DeleteProjectRoute,
  ListProjectsRoute,
  RenameProjectRoute,
} from "./routes";

export function createListProjectsHandler(store: ProjectRepository): AppRouteHandler<ListProjectsRoute> {
  return async (c) => {
    return c.json(await store.list(), HttpStatusCodes.OK);
  };
}

export function createCreateProjectHandler(store: ProjectRepository): AppRouteHandler<CreateProjectRoute> {
  return async (c) => {
    const { name } = c.req.valid("json");
    const project = await store.create(name);
    return c.json(project, HttpStatusCodes.CREATED);
  };
}

export function createRenameProjectHandler(store: ProjectRepository): AppRouteHandler<RenameProjectRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");
    const project = await store.rename(id, name);
    if (!project) {
      return c.json({ message: `找不到專案：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json(project, HttpStatusCodes.OK);
  };
}

export function createDeleteProjectHandler(store: ProjectRepository): AppRouteHandler<DeleteProjectRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await store.remove(id);
    if (!deleted) {
      return c.json({ message: `找不到專案：${id}` }, HttpStatusCodes.NOT_FOUND);
    }
    return c.body(null, HttpStatusCodes.NO_CONTENT);
  };
}
