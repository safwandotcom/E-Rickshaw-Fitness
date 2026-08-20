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

const homeDistrict = '00000000-0000-0000-0000-0000000000d1';
const homeZone = '00000000-0000-0000-0000-0000000000a1';
const otherDistrict = '00000000-0000-0000-0000-0000000000d2';
const otherZone = '00000000-0000-0000-0000-0000000000a2';

async function tokenWithScope(app, roles, districtIds = [homeDistrict], zoneIds = [homeZone]) {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/dev-token', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000701', roles, district_ids: districtIds, zone_ids: zoneIds })
  });
  return response.json().access_token;
}

function unreachableDb() {
  return { async ready() { return true; }, async query() { throw new Error('query should not run'); }, async transaction() { throw new Error('transaction should not run'); } };
}

test('registering a rickshaw outside the inspector\'s assigned zone is rejected', async () => {
  const app = await buildApp(config, unreachableDb());
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/rickshaws',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ chassis_number: 'er-8821', owner_phone: '01711000000', district_id: otherDistrict, zone_id: otherZone })
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('a role without registry access cannot register a rickshaw', async () => {
  const app = await buildApp(config, unreachableDb());
  const token = await tokenWithScope(app, ['finance_operator']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/rickshaws',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ chassis_number: 'er-8821', owner_phone: '01711000000', district_id: homeDistrict, zone_id: homeZone })
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('registering a rickshaw uppercases identifiers and encrypts the owner phone', async () => {
  let captured = null;
  const db = {
    async ready() { return true; },
    async query(sql, values) {
      if (sql.startsWith('INSERT INTO rickshaws')) { captured = values; return { rows: [{ id: 'rickshaw-1', status: 'pending' }] }; }
      if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async transaction() { throw new Error('transaction should not run'); }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/rickshaws',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ chassis_number: 'er-8821', motor_number: 'mtr-11', owner_phone: '01711000000', district_id: homeDistrict, zone_id: homeZone })
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { data: { id: 'rickshaw-1', status: 'pending' } });
  assert.equal(captured[0], 'ER-8821');
  assert.equal(captured[1], 'MTR-11');
  assert.ok(Buffer.isBuffer(captured[2]));
  assert.notEqual(captured[2].toString('utf8'), '01711000000');
  assert.equal(captured[3], homeDistrict);
  assert.equal(captured[4], homeZone);
  await app.close();
});

test('looking up an unregistered chassis number returns no data', async () => {
  const db = { async ready() { return true; }, async query() { return { rows: [] }; }, async transaction() { throw new Error('transaction should not run'); } };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({ method: 'GET', url: '/api/v1/rickshaws?chassis_number=ER-9999', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { data: null });
  await app.close();
});

test('looking up a vehicle outside the caller\'s zone is rejected', async () => {
  const db = {
    async ready() { return true; },
    async query() { return { rows: [{ id: 'rickshaw-1', chassis_number: 'ER-8821', motor_number: null, district_id: otherDistrict, zone_id: otherZone, status: 'pending' }] }; },
    async transaction() { throw new Error('transaction should not run'); }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({ method: 'GET', url: '/api/v1/rickshaws?chassis_number=ER-8821', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('looking up a vehicle in the caller\'s zone returns it', async () => {
  const db = {
    async ready() { return true; },
    async query() { return { rows: [{ id: 'rickshaw-1', chassis_number: 'ER-8821', motor_number: null, district_id: homeDistrict, zone_id: homeZone, status: 'pending' }] }; },
    async transaction() { throw new Error('transaction should not run'); }
  };
  const app = await buildApp(config, db);
  const token = await tokenWithScope(app, ['inspector']);
  const response = await app.inject({ method: 'GET', url: '/api/v1/rickshaws?chassis_number=ER-8821', headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.id, 'rickshaw-1');
  await app.close();
});
