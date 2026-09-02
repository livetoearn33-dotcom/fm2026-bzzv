import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

import type { AppRouteHandler } from "@/shared/types";

import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/shared/utils";

import type { TaskServices } from "../services";
import type { CreateRoute, GetOneRoute, ListRoute, PatchRoute, RemoveRoute } from "./routes";

export function createListHandler(services: TaskServices): AppRouteHandler<ListRoute> {
  return async (c) => {
    const tasks = await services.listTasks();
    return c.json(tasks);
  };
}

export function createCreateHandler(services: TaskServices): AppRouteHandler<CreateRoute> {
  return async (c) => {
    const task = c.req.valid("json");
    const created = await services.createTask(task);
    return c.json(created, HttpStatusCodes.OK);
  };
}

export function createGetOneHandler(services: TaskServices): AppRouteHandler<GetOneRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");

    try {
      const task = await services.getTask(id);
      return c.json(task, HttpStatusCodes.OK);
    }
    catch {
      return c.json(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND,
      );
    }
  };
}

export function createPatchHandler(services: TaskServices): AppRouteHandler<PatchRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");

    if (Object.keys(updates).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            issues: [
              {
                code: ZOD_ERROR_CODES.INVALID_UPDATES,
                path: [],
                message: ZOD_ERROR_MESSAGES.NO_UPDATES,
              },
            ],
            name: "ZodError",
          },
        },
        HttpStatusCodes.UNPROCESSABLE_ENTITY,
      );
    }

    try {
      const task = await services.updateTask(id, updates);
      return c.json(task, HttpStatusCodes.OK);
    }
    catch {
      return c.json(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND,
      );
    }
  };
}

export function createRemoveHandler(services: TaskServices): AppRouteHandler<RemoveRoute> {
  return async (c) => {
    const { id } = c.req.valid("param");

    try {
      await services.deleteTask(id);
      return c.body(null, HttpStatusCodes.NO_CONTENT);
    }
    catch {
      return c.json(
        { message: HttpStatusPhrases.NOT_FOUND },
        HttpStatusCodes.NOT_FOUND,
      );
    }
  };
}
