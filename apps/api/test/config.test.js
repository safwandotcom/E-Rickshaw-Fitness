import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../dist/config.js';

const base = {
  NODE_ENV: 'production', PORT: '3000', HOST: '0.0.0.0',
  DATABASE_URL: 'postgres://erf:secret@localhost:5432/erf',
  REDIS_URL: 'redis://localhost:6379', RABBITMQ_URL: 'amqp://erf:secret@localhost:5672',
  AUTH_JWT_SECRET: 'local-development-jwt-secret-change-me',
  DATA_ENCRYPTION_SECRET: 'local-development-data-secret-change-me',
  MFS_WEBHOOK_SECRET: 'local-development-mfs-webhook-secret'
};

test('rejects development secrets in production configuration', () => {
  assert.throws(() => loadConfig(base), /Production configuration/);
});
