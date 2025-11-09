export type ErrorDetails = Record<string, unknown>;

export class ApplicationError extends Error {
  public readonly statusCode: number;

  public readonly details?: ErrorDetails;

  constructor(message: string, statusCode = 500, details?: ErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 400, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 404, details);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized', details?: ErrorDetails) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Forbidden', details?: ErrorDetails) {
    super(message, 403, details);
  }
}

