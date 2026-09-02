import { AppError } from "@/shared/errors";

export class TaskNotFoundError extends AppError {
  constructor(taskId: number) {
    super(`找不到任務 ${taskId}`, "TASK_NOT_FOUND", 404);
  }
}

export class TaskValidationError extends AppError {
  constructor(message: string) {
    super(message, "TASK_VALIDATION_ERROR", 422);
  }
}
