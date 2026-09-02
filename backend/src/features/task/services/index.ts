import type { TaskServiceDeps } from "../domain/entities";

import { createCreateTaskService } from "./create-task";
import { createDeleteTaskService } from "./delete-task";
import { createGetTaskService } from "./get-task";
import { createListTasksService } from "./list-tasks";
import { createUpdateTaskService } from "./update-task";

export function createTaskServices(deps: TaskServiceDeps) {
  return {
    listTasks: createListTasksService(deps),
    getTask: createGetTaskService(deps),
    createTask: createCreateTaskService(deps),
    updateTask: createUpdateTaskService(deps),
    deleteTask: createDeleteTaskService(deps),
  };
}

export type TaskServices = ReturnType<typeof createTaskServices>;
