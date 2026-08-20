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

const districtId = '00000000-0000-0000-0000-0000000000d1';
const zoneId = '00000000-0000-0000-0000-0000000000a1';

async function tokenWithScope(app, roles) {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/dev-token', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000601', roles, district_ids: [districtId], zone_ids: [zoneId] })
  });
  return response.json().access_token;
}

test('voiding an inspection expires its unpaid bill and reverts the rickshaw to pending', async () => {
  const calls = [];
  const db = {
    async ready() { return true; },
    async query(sql) { if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] }; throw new Error(`Unexpected top-level query: ${sql}`); },
    async transaction(work) {
      return work({
        async query(sql, values) {
          calls.push(sql.split('\n')[0].trim());
          if (sql.startsWith('SELECT i.status')) return { rows: [{ status: 'passed', rickshaw_id: 'rickshaw-1', district_id: districtId, zone_id: zoneId }] };
          if (sql.startsWith('UPDATE inspections')) { assert.equal(values[1], 'documentation error'); return { rows: [] }; }
          if (sql.startsWith('UPDATE bills')) return { rows: [] };
          if (sql.startsWith('UPDATE rickshaws')) return { rows: [] };
          throw new Error(`Unexpected transaction query: ${sql}`);
        }
      });
    }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['hub_supervisor']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/inspections/11111111-1111-1111-1111-111111111111/void',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ reason_code: 'documentation error' })
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: { voided: true } });
  assert.ok(calls.some((sql) => sql.startsWith('UPDATE bills')));
  assert.ok(calls.some((sql) => sql.startsWith('UPDATE rickshaws')));
  await app.close();
});

test('voiding an inspection is idempotent when already voided', async () => {
  const db = {
    async ready() { return true; },
    async query() { throw new Error('unexpected'); },
    async transaction(work) {
      return work({ async query(sql) { if (sql.startsWith('SELECT i.status')) return { rows: [{ status: 'voided', rickshaw_id: 'rickshaw-1', district_id: districtId, zone_id: zoneId }] }; throw new Error(`Unexpected query: ${sql}`); } });
    }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['hub_supervisor']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/inspections/11111111-1111-1111-1111-111111111111/void',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ reason_code: 'already handled' })
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: { voided: true, duplicate: true } });
  await app.close();
});

test('voiding a draft inspection is rejected', async () => {
  const db = {
    async ready() { return true; },
    async query() { throw new Error('unexpected'); },
    async transaction(work) {
      return work({ async query(sql) { if (sql.startsWith('SELECT i.status')) return { rows: [{ status: 'draft', rickshaw_id: 'rickshaw-1', district_id: districtId, zone_id: zoneId }] }; throw new Error(`Unexpected query: ${sql}`); } });
    }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['hub_supervisor']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/inspections/11111111-1111-1111-1111-111111111111/void',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ reason_code: 'not applicable' })
  });
  assert.equal(response.statusCode, 409);
  await app.close();
});

test('an inspector cannot void an inspection', async () => {
  const db = { async ready() { return true; }, async query() { throw new Error('should not query'); }, async transaction() { throw new Error('should not run'); } };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/inspections/11111111-1111-1111-1111-111111111111/void',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ reason_code: 'not allowed' })
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

function renewDb(certificateStatus, supersededByCertificateId = null) {
  return {
    async ready() { return true; },
    async query(sql) { if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] }; throw new Error(`Unexpected top-level query: ${sql}`); },
    async transaction(work) {
      return work({
        async query(sql) {
          if (sql.includes('FROM certificates c JOIN rickshaws')) return { rows: [{ status: certificateStatus, rickshaw_id: 'rickshaw-1', district_id: districtId, zone_id: zoneId, chassis_number: 'ER-1234-CHASSIS', zone_code: 'DHK-N-04', owner_phone_encrypted: Buffer.from('cipher'), superseded_by_certificate_id: supersededByCertificateId }] };
          if (sql.startsWith('SELECT short_code FROM certificates')) return { rows: [{ short_code: 'EXIST1' }] };
          if (sql.startsWith('INSERT INTO certificates')) return { rows: [{ id: 'certificate-new', short_code: 'NEWCODE', expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }] };
          if (sql.startsWith('UPDATE certificates SET qr_payload')) return { rows: [] };
          if (sql.startsWith('INSERT INTO outbox_events')) return { rows: [] };
          if (sql.startsWith('UPDATE certificates SET status')) return { rows: [] };
          if (sql.startsWith('INSERT INTO notification_jobs')) return { rows: [] };
          throw new Error(`Unexpected transaction query: ${sql}`);
        }
      });
    }
  };
}

test('renewing an active certificate supersedes it and issues a new one', async () => {
  const app = await buildApp(config, renewDb('active'));
  const token = await tokenWithScope(app, ['district_administrator']);
  const response = await app.inject({ method: 'POST', url: '/api/v1/admin/certificates/22222222-2222-2222-2222-222222222222/renew', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: { renewed: true, certificate_short_code: 'NEWCODE' } });
  await app.close();
});

test('renewing an already-renewed certificate returns the existing successor idempotently', async () => {
  const app = await buildApp(config, renewDb('superseded', 'certificate-new'));
  const token = await tokenWithScope(app, ['district_administrator']);
  const response = await app.inject({ method: 'POST', url: '/api/v1/admin/certificates/22222222-2222-2222-2222-222222222222/renew', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: { renewed: true, duplicate: true, certificate_short_code: 'EXIST1' } });
  await app.close();
});

test('renewing a revoked certificate is rejected', async () => {
  const app = await buildApp(config, renewDb('revoked'));
  const token = await tokenWithScope(app, ['district_administrator']);
  const response = await app.inject({ method: 'POST', url: '/api/v1/admin/certificates/22222222-2222-2222-2222-222222222222/renew', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 409);
  await app.close();
});
