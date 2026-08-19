import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import { Database } from './db.js';
import { DevelopmentQrSigner } from './lib/crypto.js';
import { registerRoutes } from './routes.js';

export async function buildApp(config: AppConfig, db: Database): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    requestIdHeader: 'x-request-id'
  });

  await app.register(cors, {
    origin: config.NODE_ENV === 'production' ? false : true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']
  });
  await app.register(jwt, { secret: config.AUTH_JWT_SECRET });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => done(null, body));

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await db.ready();
      return { status: 'ready', dependencies: { database: 'ok', redis: 'not_checked', queue: 'not_checked' } };
    } catch {
      return reply.code(503).send({ status: 'not_ready', dependencies: { database: 'unavailable', redis: 'not_checked', queue: 'not_checked' } });
    }
  });

  app.get('/api/v1', async () => ({
    service: 'e-rickshaw-fitness-api',
    version: 'v1'
  }));

  registerRoutes(app, config, db, new DevelopmentQrSigner(config.QR_SIGNING_KEY_ID));

  return app;
}
