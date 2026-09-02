import type { TaskServiceDeps, UpdateTaskFn } from "../domain/entities";

import { TaskNotFoundError } from "../domain/errors";

export function createUpdateTaskService(deps: TaskServiceDeps): UpdateTaskFn {
  const { taskRepository } = deps;

  return async (id, data) => {
    const task = await taskRepository.update(id, data);

    if (!task) {
      throw new TaskNotFoundError(id);
    }

    return task;
  };
}
