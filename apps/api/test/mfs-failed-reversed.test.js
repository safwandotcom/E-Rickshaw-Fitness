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

function failedDb() {
  let recorded = false;
  return {
    async ready() { return true; },
    async query(sql) { throw new Error(`Unexpected top-level query: ${sql}`); },
    async transaction(work) {
      return work({
        async query(sql) {
          if (sql.startsWith('SELECT id FROM payments')) return { rows: recorded ? [{ id: 'payment-1' }] : [] };
          if (sql.startsWith('SELECT id FROM bills')) return { rows: [{ id: 'bill-1' }] };
          if (sql.startsWith('INSERT INTO payments')) { recorded = true; return { rows: [] }; }
          throw new Error(`Unexpected transaction query: ${sql}`);
        }
      });
    }
  };
}

test('failed MFS callback records the attempt without changing the bill, and is idempotent', async () => {
  const app = await buildApp(config, failedDb());
  const body = JSON.stringify({ event_id: 'evt-f1', bill_code: '902190', transaction_id: 'trx-failed-1', amount_paisa: 50000, status: 'failed' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) };
  const first = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  const second = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json(), { data: { accepted: true, outcome: 'failed', duplicate: false } });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), { data: { accepted: true, outcome: 'failed', duplicate: true } });
  await app.close();
});

test('failed MFS callback for an unknown bill is rejected', async () => {
  const db = {
    async ready() { return true; },
    async query() { throw new Error('unexpected'); },
    async transaction(work) {
      return work({
        async query(sql) {
          if (sql.startsWith('SELECT id FROM payments')) return { rows: [] };
          if (sql.startsWith('SELECT id FROM bills')) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        }
      });
    }
  };
  const app = await buildApp(config, db);
  const body = JSON.stringify({ event_id: 'evt-f2', bill_code: '902199', transaction_id: 'trx-failed-2', amount_paisa: 50000, status: 'failed' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) };
  const response = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  assert.equal(response.statusCode, 409);
  await app.close();
});

function reversedDb() {
  let paymentStatus = 'paid';
  return {
    async ready() { return true; },
    async query(sql) {
      if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
      throw new Error(`Unexpected top-level query: ${sql}`);
    },
    async transaction(work) {
      return work({
        async query(sql) {
          if (sql.includes('FROM payments WHERE provider')) return { rows: [{ id: 'payment-1', bill_id: 'bill-1', status: paymentStatus }] };
          if (sql.startsWith("UPDATE payments SET status = 'reversed'")) { paymentStatus = 'reversed'; return { rows: [] }; }
          if (sql.startsWith("UPDATE bills SET status = 'reversed'")) return { rows: [] };
          if (sql.startsWith('SELECT rickshaw_id FROM bills')) return { rows: [{ rickshaw_id: 'rick-1' }] };
          if (sql.includes('FROM certificates WHERE rickshaw_id')) return { rows: [{ id: 'cert-1' }] };
          if (sql.startsWith("UPDATE certificates SET status = 'revoked'")) return { rows: [] };
          if (sql.startsWith("UPDATE rickshaws SET status = 'suspended'")) return { rows: [] };
          if (sql.startsWith('INSERT INTO certificate_revocations')) return { rows: [] };
          throw new Error(`Unexpected transaction query: ${sql}`);
        }
      });
    }
  };
}

test('reversed MFS callback revokes the active certificate and is idempotent', async () => {
  const app = await buildApp(config, reversedDb());
  const body = JSON.stringify({ event_id: 'evt-r1', bill_code: '902191', transaction_id: 'trx-reversed-1', amount_paisa: 50000, status: 'reversed' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) };
  const first = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  const second = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json(), { data: { accepted: true, outcome: 'reversed', duplicate: false } });
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), { data: { accepted: true, outcome: 'reversed', duplicate: true } });
  await app.close();
});

test('reversed MFS callback for an unrecorded transaction is rejected', async () => {
  const db = {
    async ready() { return true; },
    async query() { throw new Error('unexpected'); },
    async transaction(work) {
      return work({ async query(sql) { if (sql.includes('FROM payments WHERE provider')) return { rows: [] }; throw new Error(`Unexpected query: ${sql}`); } });
    }
  };
  const app = await buildApp(config, db);
  const body = JSON.stringify({ event_id: 'evt-r2', bill_code: '902192', transaction_id: 'trx-unknown', amount_paisa: 50000, status: 'reversed' });
  const headers = { 'content-type': 'application/json', 'x-erf-signature': signed(body, config.MFS_WEBHOOK_SECRET) };
  const response = await app.inject({ method: 'POST', url: '/api/v1/webhooks/mfs/bkash', headers, payload: body });
  assert.equal(response.statusCode, 409);
  await app.close();
});
