import type { CreateTaskFn, TaskServiceDeps } from "../domain/entities";

export function createCreateTaskService(deps: TaskServiceDeps): CreateTaskFn {
  const { taskRepository } = deps;

  return async (data) => {
    return await taskRepository.create(data);
  };
}
