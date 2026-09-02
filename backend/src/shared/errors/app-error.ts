import * as HttpStatusCodes from "stoker/http-status-codes";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = HttpStatusCodes.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", HttpStatusCodes.BAD_REQUEST);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`找不到 ${resource}`, "NOT_FOUND", HttpStatusCodes.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", HttpStatusCodes.CONFLICT);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "未授權") {
    super(message, "UNAUTHORIZED", HttpStatusCodes.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "禁止存取") {
    super(message, "FORBIDDEN", HttpStatusCodes.FORBIDDEN);
  }
}
