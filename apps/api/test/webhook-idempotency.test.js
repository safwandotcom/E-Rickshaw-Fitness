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

function signed(body, secret) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

test('MFS callback is idempotent for a repeated provider transaction', async () => {
  let transactionCalls = 0;
  const db = {
    async ready() { return true; },
    async query(sql) {
      throw new Error(`Unexpected query: ${sql}`);
    },
    async transaction(work) {
      transactionCalls += 1;
      return work({
        async query(sql) {
          assert.match(sql, /SELECT id FROM payments/);
          return { rows: [{ id: 'payment-existing' }] };
        }
      });
    }
  };
  const app = await buildApp(config, db);
  const body = JSON.stringify({ event_id: 'evt-1', bill_code: '902184', transaction_id: 'trx-duplicate', amount_paisa: 50000, status: 'paid' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) };
  const first = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  const second = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.deepEqual(first.json(), { data: { accepted: true, duplicate: true } });
  assert.deepEqual(second.json(), { data: { accepted: true, duplicate: true } });
  assert.equal(transactionCalls, 2);
  await app.close();
});

test('MFS callback rejects a tampered body before opening a transaction', async () => {
  let transactions = 0;
  const db = {
    async ready() { return true; },
    async query() { throw new Error('query should not run'); },
    async transaction() { transactions += 1; throw new Error('transaction should not run'); }
  };
  const app = await buildApp(config, db);
  const body = JSON.stringify({ event_id: 'evt-2', bill_code: '902185', transaction_id: 'trx-2', amount_paisa: 50000, status: 'paid' });
  const response = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/nagad', headers: { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) }, payload: `${body} ` });
  assert.equal(response.statusCode, 401);
  assert.equal(transactions, 0);
  await app.close();
});

test('SMS delivery callback is safe to retry with the same signed event', async () => {
  let updates = 0;
  const db = {
    async ready() { return true; },
    async query(sql) {
      assert.match(sql, /UPDATE notification_jobs/);
      updates += 1;
      return { rows: [{ id: 'job-1' }] };
    },
    async transaction() { throw new Error('transaction should not run'); }
  };
  const app = await buildApp(config, db);
  const body = JSON.stringify({ provider_message_id: 'provider-retry', status: 'delivered' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.SMS_WEBHOOK_SECRET) };
  const first = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sms/teletalk', headers, payload: body });
  const retry = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sms/teletalk', headers, payload: body });
  assert.equal(first.statusCode, 200);
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(retry.json(), { data: { accepted: true } });
  assert.equal(updates, 2);
  await app.close();
});
