import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { buildApp } from '../dist/app.js';

const config = {
  NODE_ENV: 'development', PORT: 3000, HOST: '127.0.0.1',
  DATABASE_URL: 'postgres://erf:password@localhost:5432/erf', REDIS_URL: 'redis://localhost:6379',
  RABBITMQ_URL: 'amqp://erf:password@localhost:5672', LOG_LEVEL: 'silent',
  AUTH_JWT_SECRET: 'local-development-jwt-secret-change-me',
  DATA_ENCRYPTION_SECRET: 'local-development-data-secret-change-me',
  MFS_WEBHOOK_SECRET: 'local-development-mfs-webhook-secret',
  SMS_WEBHOOK_SECRET: 'sms-test-secret', QR_SIGNING_KEY_ID: 'test-key'
};

const fakeDb = {
  async ready() { return true; },
  async query(sql) {
    if (sql.startsWith('UPDATE notification_jobs')) return { rows: [{ id: 'job-1' }] };
    throw new Error(`Unexpected query in operational endpoint test: ${sql}`);
  },
  async transaction() { throw new Error('Database transaction was not expected in this test.'); }
};

async function appWithToken() {
  const app = await buildApp(config, fakeDb);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/dev-token', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000201', roles: ['inspector'], district_ids: [], zone_ids: [] })
  });
  return { app, token: response.json().access_token };
}

test('verifier key manifest is publicly available and QR rejects tampering', async () => {
  const app = await buildApp(config, fakeDb);
  const keys = await app.inject({ method: 'GET', url: '/api/v1/verifier/keys' });
  assert.equal(keys.statusCode, 200);
  assert.equal(keys.json().data[0].key_id, 'test-key');
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/public/verify/qr', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ token: 'not-a-valid-token' }) });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().data.reason, 'invalid_signature');
  await app.close();
});

test('admin report endpoint enforces role before querying data', async () => {
  const { app, token } = await appWithToken();
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/reports/summary', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('SMS callback rejects invalid signatures and accepts signed delivery updates', async () => {
  const app = await buildApp(config, fakeDb);
  const payload = JSON.stringify({ provider_message_id: 'provider-1', status: 'delivered' });
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sms/test', headers: { 'content-type': 'application/json', 'x-erf-signature': 'bad' }, payload });
  assert.equal(invalid.statusCode, 401);
  const signature = createHmac('sha256', config.SMS_WEBHOOK_SECRET).update(payload).digest('hex');
  const valid = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sms/test', headers: { 'content-type': 'application/json', 'x-erf-signature': signature }, payload });
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.json(), { data: { accepted: true } });
  await app.close();
});
