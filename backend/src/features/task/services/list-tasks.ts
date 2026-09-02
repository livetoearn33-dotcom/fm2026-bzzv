import type { ListTasksFn, TaskServiceDeps } from "../domain/entities";

export function createListTasksService(deps: TaskServiceDeps): ListTasksFn {
  const { taskRepository } = deps;

  return async () => {
    return await taskRepository.findAll();
  };
}
