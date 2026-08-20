import assert from 'node:assert/strict';
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

async function tokenWithRoles(app, roles) {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/dev-token', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000501', roles, district_ids: [], zone_ids: [] })
  });
  return response.json().access_token;
}

test('reconciliation endpoint enforces role before querying data', async () => {
  const db = { async ready() { return true; }, async query() { throw new Error('should not query'); }, async transaction() { throw new Error('should not run'); } };
  const app = await buildApp(config, db);
  const token = await tokenWithRoles(app, ['inspector']);
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/reconciliation', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('reconciliation endpoint lists failed and reversed payments for finance operators', async () => {
  const db = {
    async ready() { return true; },
    async query(sql) {
      assert.match(sql, /FROM bills b/);
      return { rows: [{
        bill_code: '902190', bill_status: 'unpaid', bill_amount_paisa: '50000', bill_expires_at: new Date('2026-08-22T00:00:00Z'),
        provider: 'bkash', provider_transaction_id: 'trx-failed-1', payment_status: 'failed', payment_amount_paisa: '50000', payment_at: new Date('2026-08-20T00:00:00Z')
      }] };
    },
    async transaction() { throw new Error('should not run'); }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithRoles(app, ['finance_operator']);
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/reconciliation', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].bill_amount_paisa, 50000);
  assert.equal(body.data[0].payment_status, 'failed');
  await app.close();
});
