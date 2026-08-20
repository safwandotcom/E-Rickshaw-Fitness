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

const fakeDb = {
  async ready() { return true; },
  async query(sql, values) {
    if (sql.startsWith('INSERT INTO inspection_templates')) return { rows: [{ id: 'template-1', version: values[0] }] };
    if (sql.startsWith('INSERT INTO audit_events')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  },
  async transaction() { throw new Error('Database transaction was not expected in this test.'); }
};

async function centralAdminToken(app) {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/dev-token', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000401', roles: ['central_administrator'], district_ids: [], zone_ids: [] })
  });
  return response.json().access_token;
}

test('rejects a checklist template whose schema_json has no fields', async () => {
  const app = await buildApp(config, fakeDb);
  const token = await centralAdminToken(app);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/admin/inspection-templates',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ version: 'v2', vehicle_type: 'e-rickshaw', schema_json: { required: ['brakes'] }, effective_from: new Date().toISOString() })
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test('accepts a checklist template with a well-formed field schema', async () => {
  const app = await buildApp(config, fakeDb);
  const token = await centralAdminToken(app);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/admin/inspection-templates',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({
      version: 'v2', vehicle_type: 'e-rickshaw',
      schema_json: { fields: [{ key: 'brakes', label: 'Brakes', label_bn: 'ব্রেক', type: 'pass_fail_na' }, { key: 'notes', label: 'Notes', type: 'text' }] },
      effective_from: new Date().toISOString()
    })
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.version, 'v2');
  await app.close();
});

test('rejects a checklist field key that is not lowercase snake_case', async () => {
  const app = await buildApp(config, fakeDb);
  const token = await centralAdminToken(app);
  const response = await app.inject({
    method: 'POST', url: '/api/v1/admin/inspection-templates',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    payload: JSON.stringify({ version: 'v2', vehicle_type: 'e-rickshaw', schema_json: { fields: [{ key: 'Brakes Check', label: 'Brakes', type: 'pass_fail_na' }] }, effective_from: new Date().toISOString() })
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});
