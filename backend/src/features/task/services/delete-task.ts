import type { DeleteTaskFn, TaskServiceDeps } from "../domain/entities";

import { TaskNotFoundError } from "../domain/errors";

export function createDeleteTaskService(deps: TaskServiceDeps): DeleteTaskFn {
  const { taskRepository } = deps;

  return async (id) => {
    const deleted = await taskRepository.delete(id);

    if (!deleted) {
      throw new TaskNotFoundError(id);
    }
  };
}
