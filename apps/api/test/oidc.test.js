import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../dist/config.js';

test('requires OIDC settings outside local development', () => {
  assert.throws(() => loadConfig({
    NODE_ENV: 'staging', PORT: '3000', HOST: '0.0.0.0',
    DATABASE_URL: 'postgres://erf:password@localhost:5432/erf',
    REDIS_URL: 'redis://localhost:6379', RABBITMQ_URL: 'amqp://erf:password@localhost:5672',
    AUTH_JWT_SECRET: 'staging-jwt-secret-that-is-long-enough',
    DATA_ENCRYPTION_SECRET: 'staging-data-secret-that-is-long-enough',
    MFS_WEBHOOK_SECRET: 'staging-mfs-secret-that-is-long-enough',
    QR_SIGNING_KEY_ID: 'staging-key', OIDC_ENABLED: 'false'
  }), /require OIDC/);
});
