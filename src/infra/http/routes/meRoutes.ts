import type { FastifyInstance } from 'fastify';

export function registerMeRoutes(app: FastifyInstance): void {
  app.register((instance, _opts, done) => {
    instance.addHook('preHandler', async (request, reply) => {
      await instance.authenticate(request, reply);
    });

    instance.get('/v1/me/profile', async (request, reply) => {
      if (!request.currentUser) {
        void reply.status(500);
        return { error: 'User context missing' };
      }

      return {
        user: {
          id: request.currentUser.id,
          auth0Sub: request.currentUser.auth0Sub,
          email: request.currentUser.email,
          name: request.currentUser.name,
          createdAt: request.currentUser.createdAt,
          updatedAt: request.currentUser.updatedAt,
        },
      };
    });

    done();
  });
}

