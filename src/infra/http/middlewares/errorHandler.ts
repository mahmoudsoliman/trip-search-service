import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { ApplicationError } from '../../../utils/errors';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      error: FastifyError | ApplicationError,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const statusCode =
        error instanceof ApplicationError ? error.statusCode : error.statusCode ?? 500;

      if (statusCode >= 500) {
        request.log.error({ err: error, path: request.raw.url }, 'Request failed');
      } else {
        request.log.warn({ err: error, path: request.raw.url }, 'Request failed');
      }

      const responseBody = {
        error: error.name ?? 'Error',
        message: error.message,
        statusCode,
      };

      if (error instanceof ApplicationError && error.details) {
        Object.assign(responseBody, { details: error.details });
      }

      void reply.status(statusCode).send(responseBody);
    },
  );
}

