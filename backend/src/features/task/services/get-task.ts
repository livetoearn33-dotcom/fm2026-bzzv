import type { GetTaskFn, TaskServiceDeps } from "../domain/entities";

import { TaskNotFoundError } from "../domain/errors";

export function createGetTaskService(deps: TaskServiceDeps): GetTaskFn {
  const { taskRepository } = deps;

  return async (id) => {
    const task = await taskRepository.findById(id);

    if (!task) {
      throw new TaskNotFoundError(id);
    }

    return task;
  };
}
