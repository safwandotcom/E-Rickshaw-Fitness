import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../dist/app.js';

const config = {
  NODE_ENV: 'development',
  PORT: 3000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgres://erf:password@localhost:5432/erf',
  REDIS_URL: 'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://erf:password@localhost:5672',
  LOG_LEVEL: 'silent',
  AUTH_JWT_SECRET: 'local-development-jwt-secret-change-me',
  DATA_ENCRYPTION_SECRET: 'local-development-data-secret-change-me',
  MFS_WEBHOOK_SECRET: 'local-development-mfs-webhook-secret',
  QR_SIGNING_KEY_ID: 'test-key'
};

const fakeDb = {
  async ready() { return true; },
  async query() { throw new Error('Database query was not expected in this smoke test.'); },
  async transaction() { throw new Error('Database transaction was not expected in this smoke test.'); }
};

test('serves liveness and development token endpoints', async () => {
  const app = await buildApp(config, fakeDb);
  const live = await app.inject({ method: 'GET', url: '/health/live' });
  assert.equal(live.statusCode, 200);
  assert.deepEqual(live.json(), { status: 'ok' });

  const token = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/dev-token',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000201', roles: ['inspector'], district_ids: [], zone_ids: [] })
  });
  assert.equal(token.statusCode, 200);
  assert.match(token.json().access_token, /^ey/);
  await app.close();
});

test('does not expose development tokens outside local development', async () => {
  const app = await buildApp({ ...config, NODE_ENV: 'staging' }, fakeDb);
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/dev-token',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000201', roles: ['inspector'], district_ids: [], zone_ids: [] })
  });
  assert.equal(response.statusCode, 404);
  await app.close();
});
