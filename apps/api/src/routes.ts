import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { Database, type Queryable } from './db.js';
import { DevelopmentQrSigner, FieldCipher } from './lib/crypto.js';
import { AuthorizationError, type Principal, type Role, requireRole, requireZoneAccess } from './lib/authorization.js';
import { OidcVerifier } from './lib/oidc.js';
import { renderCertificatePdf } from './lib/certificate-pdf.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Principal;
    user: Principal;
  }
}

const rickshawInput = z.object({
  chassis_number: z.string().trim().min(4).max(64),
  motor_number: z.string().trim().min(2).max(64).optional(),
  owner_phone: z.string().trim().min(8).max(20),
  district_id: z.string().uuid(),
  zone_id: z.string().uuid()
});
const inspectionInput = z.object({
  rickshaw_id: z.string().uuid(),
  template_id: z.string().uuid(),
  checklist_data: z.record(z.unknown()),
  result: z.enum(['pass', 'fail']),
  client_timestamp: z.string().datetime().optional()
});
const callbackInput = z.object({
  event_id: z.string().min(1),
  bill_code: z.string().regex(/^\d{6,8}$/),
  transaction_id: z.string().min(1),
  amount_paisa: z.number().int().positive(),
  status: z.enum(['paid', 'failed', 'reversed'])
});
const reasonInput = z.object({ reason_code: z.string().trim().min(2).max(64) });
const userProvisionInput = z.object({
  external_subject: z.string().trim().min(2).max(256),
  display_name: z.string().trim().min(2).max(160),
  roles: z.array(z.enum(['inspector', 'hub_supervisor', 'district_administrator', 'central_administrator', 'finance_operator', 'traffic_police_verifier'])).min(1),
  scopes: z.array(z.object({ district_id: z.string().uuid(), zone_id: z.string().uuid() })).default([])
});
const smsStatusInput = z.object({ provider_message_id: z.string().min(1), status: z.enum(['delivered', 'failed']), error: z.string().max(500).optional() });
// A checklist template describes one field per inspected item. `pass_fail_na`
// fields render as a three-state choice in the inspector app; `text` fields
// capture free-form notes. The inspector app renders this schema directly
// rather than hardcoding checklist fields, so a new template version can add
// or change checks without a client release.
const checklistFieldInput = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/, 'Field keys must be lowercase snake_case.'),
  label: z.string().trim().min(1).max(160),
  label_bn: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['pass_fail_na', 'text'])
});
const templateInput = z.object({ version: z.string().trim().min(1).max(64), vehicle_type: z.string().trim().min(1).max(64), schema_json: z.object({ fields: z.array(checklistFieldInput).min(1) }), effective_from: z.string().datetime(), effective_to: z.string().datetime().optional() });

function parseJson(request: FastifyRequest): unknown {
  if (typeof request.body !== 'string') throw new Error('Expected a JSON request body.');
  return JSON.parse(request.body);
}

class AuthenticationError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthenticationError'; }
}

async function principalFor(request: FastifyRequest, config: AppConfig, oidc: OidcVerifier | null, db: Database): Promise<Principal> {
  if (config.OIDC_ENABLED) {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ') || !oidc) throw new AuthenticationError('A valid OIDC bearer token is required.');
    try {
      const external = await oidc.verify(authorization.slice('Bearer '.length));
      const user = await db.query<{ id: string; status: string }>('SELECT id, status FROM users WHERE external_subject = $1', [external.userId]);
      if (!user.rows[0] || user.rows[0].status !== 'active') throw new AuthenticationError('OIDC user is not provisioned or active.');
      const roles = await db.query<{ role_code: Role }>('SELECT role_code FROM user_roles WHERE user_id = $1', [user.rows[0].id]);
      const scopes = await db.query<{ district_id: string; zone_id: string }>('SELECT district_id, zone_id FROM user_geographies WHERE user_id = $1', [user.rows[0].id]);
      if (!roles.rows.length) throw new AuthenticationError('OIDC user has no assigned roles.');
      return { userId: user.rows[0].id, roles: roles.rows.map((row) => row.role_code), scope: { districtIds: scopes.rows.map((row) => row.district_id), zoneIds: scopes.rows.map((row) => row.zone_id) } };
    } catch (error) { if (error instanceof AuthenticationError) throw error; throw new AuthenticationError('OIDC token validation failed.'); }
  }
  await request.jwtVerify();
  return request.user;
}

function billCode(): string {
  return String(randomInt(10000000, 100000000));
}

/** Issues a new active certificate + signed QR for a rickshaw, used both by
 * the payment webhook (first issuance) and certificate renewal (reissuance
 * ahead of expiry). Does not touch any prior certificate for the rickshaw —
 * callers are responsible for superseding/revoking it if applicable.
 *
 * `billId` records which bill this certificate's lineage traces back to
 * (the bill that was actually paid for the first issuance; renewal passes
 * through its predecessor's billId unchanged). This is what lets a
 * reversed-payment webhook find the right certificate to revoke instead of
 * "whichever one happens to be active for the rickshaw right now". */
async function issueCertificate(transaction: Queryable, signer: DevelopmentQrSigner, keyId: string, rickshawId: string, chassisNumber: string, zoneCode: string, billId: string | null): Promise<{ id: string; shortCode: string; expiresAt: Date }> {
  const certificateNumber = `ERF-${new Date().getUTCFullYear()}-${randomInt(10000000, 99999999)}`;
  const qrHash = createHash('sha256').update(certificateNumber).digest();
  const certificate = await transaction.query<{ id: string; short_code: string; expires_at: Date }>(
    "INSERT INTO certificates (certificate_number, rickshaw_id, qr_hash, key_id, short_code, issued_at, expires_at, status, bill_id) VALUES ($1, $2, $3, $4, $5, now(), now() + interval '1 year', 'active', $6) RETURNING id, short_code, expires_at",
    [certificateNumber, rickshawId, qrHash, keyId, randomInt(100000, 999999).toString(), billId]
  );
  const row = certificate.rows[0];
  const qr = signer.issue({ cid: certificateNumber, ch: chassisNumber.slice(-4), zone: zoneCode, iat: Math.floor(Date.now() / 1000), exp: Math.floor(row.expires_at.getTime() / 1000) });
  await transaction.query('UPDATE certificates SET qr_payload = $1 WHERE id = $2', [qr, row.id]);
  await transaction.query("INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload) VALUES ('certificate.issued', 'certificate', $1, $2)", [row.id, { short_code: row.short_code, qr }]);
  return { id: row.id, shortCode: row.short_code, expiresAt: row.expires_at };
}

export function registerRoutes(app: FastifyInstance, config: AppConfig, db: Database, signer: DevelopmentQrSigner): void {
  const cipher = new FieldCipher(config.DATA_ENCRYPTION_SECRET);
  const oidc = config.OIDC_ENABLED ? new OidcVerifier(config) : null;

  app.post('/api/v1/auth/dev-token', async (request, reply) => {
    if (config.NODE_ENV !== 'development') return reply.code(404).send();
    const input = z.object({ user_id: z.string().uuid(), roles: z.array(z.enum(['inspector', 'hub_supervisor', 'district_administrator', 'central_administrator', 'finance_operator', 'traffic_police_verifier'])).min(1), district_ids: z.array(z.string().uuid()), zone_ids: z.array(z.string().uuid()) }).parse(parseJson(request));
    return { access_token: await reply.jwtSign({ userId: input.user_id, roles: input.roles, scope: { districtIds: input.district_ids, zoneIds: input.zone_ids } }), token_type: 'Bearer' };
  });

  app.post('/api/v1/admin/users', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['central_administrator']);
    const input = userProvisionInput.parse(parseJson(request));
    const userId = await db.transaction(async (transaction) => {
      const user = await transaction.query<{ id: string }>("INSERT INTO users (external_subject, display_name) VALUES ($1, $2) ON CONFLICT (external_subject) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'active', updated_at = now() RETURNING id", [input.external_subject, input.display_name]);
      const id = user.rows[0].id;
      await transaction.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      await transaction.query('DELETE FROM user_geographies WHERE user_id = $1', [id]);
      for (const role of input.roles) await transaction.query('INSERT INTO user_roles (user_id, role_code) VALUES ($1, $2)', [id, role]);
      for (const scope of input.scopes) {
        const zone = await transaction.query<{ valid: boolean }>('SELECT EXISTS (SELECT 1 FROM zones WHERE id = $1 AND district_id = $2) AS valid', [scope.zone_id, scope.district_id]);
        if (!zone.rows[0]?.valid) throw new Error('A geographic scope references a zone outside its district.');
        await transaction.query('INSERT INTO user_geographies (user_id, district_id, zone_id) VALUES ($1, $2, $3)', [id, scope.district_id, scope.zone_id]);
      }
      return id;
    });
    await audit(db, principal.userId, 'user.provisioned', 'user', userId, request);
    return reply.code(201).send({ data: { user_id: userId, external_subject: input.external_subject, roles: input.roles, scopes: input.scopes } });
  });

  app.get('/api/v1/rickshaws', async (request) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['inspector', 'hub_supervisor', 'district_administrator', 'central_administrator']);
    const chassis = z.string().min(1).parse((request.query as { chassis_number?: string }).chassis_number);
    const result = await db.query<{ id: string; chassis_number: string; motor_number: string | null; district_id: string; zone_id: string; status: string }>(
      'SELECT id, chassis_number, motor_number, district_id, zone_id, status FROM rickshaws WHERE chassis_number = $1', [chassis.toUpperCase()]
    );
    const item = result.rows[0];
    if (!item) return { data: null };
    requireZoneAccess(principal, item.district_id, item.zone_id);
    return { data: item };
  });

  app.get('/api/v1/admin/reports/summary', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['hub_supervisor', 'district_administrator', 'central_administrator', 'finance_operator']);
    const query = request.query as { district_id?: string };
    const districtId = query.district_id ? z.string().uuid().parse(query.district_id) : null;
    if (districtId && !principal.roles.includes('central_administrator') && !principal.scope.districtIds.includes(districtId)) return reply.code(403).send({ error: { code: 'OUT_OF_SCOPE', message: 'The selected district is outside your assignment.', request_id: request.id } });
    const args = districtId ? [districtId] : [];
    const filter = districtId ? ' WHERE district_id = $1' : '';
    const result = await db.query<{ rickshaws: string; inspections: string; paid_bills: string; active_certificates: string; queued_notifications: string }>(`SELECT
      (SELECT count(*) FROM rickshaws${filter}) AS rickshaws,
      (SELECT count(*) FROM inspections i JOIN rickshaws r ON r.id = i.rickshaw_id${districtId ? ' WHERE r.district_id = $1' : ''}) AS inspections,
      (SELECT count(*) FROM bills b JOIN rickshaws r ON r.id = b.rickshaw_id${districtId ? ' WHERE r.district_id = $1 AND' : ' WHERE'} b.status = 'paid') AS paid_bills,
      (SELECT count(*) FROM certificates c JOIN rickshaws r ON r.id = c.rickshaw_id${districtId ? ' WHERE r.district_id = $1 AND' : ' WHERE'} c.status = 'active') AS active_certificates,
      (SELECT count(*) FROM notification_jobs WHERE status IN ('queued', 'sending')) AS queued_notifications`, args);
    const row = result.rows[0];
    return { data: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) };
  });

  app.get('/api/v1/admin/reconciliation', async (request) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['finance_operator', 'central_administrator']);
    const result = await db.query<{
      bill_code: string; bill_status: string; bill_amount_paisa: string; bill_expires_at: Date;
      provider: string | null; provider_transaction_id: string | null; payment_status: string | null; payment_amount_paisa: string | null; payment_at: Date | null;
    }>(`SELECT b.bill_code, b.status AS bill_status, b.amount_paisa AS bill_amount_paisa, b.expires_at AS bill_expires_at,
              p.provider, p.provider_transaction_id, p.status AS payment_status, p.amount_paisa AS payment_amount_paisa, p.created_at AS payment_at
       FROM bills b
       LEFT JOIN payments p ON p.bill_id = b.id
       WHERE b.status IN ('reversed', 'reconciliation_required') OR p.status IN ('failed', 'reversed')
       ORDER BY COALESCE(p.created_at, b.created_at) DESC
       LIMIT 200`);
    return { data: result.rows.map((row) => ({
      bill_code: row.bill_code, bill_status: row.bill_status, bill_amount_paisa: Number(row.bill_amount_paisa), bill_expires_at: row.bill_expires_at,
      provider: row.provider, provider_transaction_id: row.provider_transaction_id, payment_status: row.payment_status,
      payment_amount_paisa: row.payment_amount_paisa === null ? null : Number(row.payment_amount_paisa), payment_at: row.payment_at
    })) };
  });

  app.post('/api/v1/rickshaws', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['inspector', 'hub_supervisor', 'district_administrator', 'central_administrator']);
    const input = rickshawInput.parse(parseJson(request));
    requireZoneAccess(principal, input.district_id, input.zone_id);
    const result = await db.query<{ id: string; status: string }>(
      'INSERT INTO rickshaws (chassis_number, motor_number, owner_phone_encrypted, district_id, zone_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, status',
      [input.chassis_number.toUpperCase(), input.motor_number?.toUpperCase() ?? null, cipher.encrypt(input.owner_phone), input.district_id, input.zone_id]
    );
    await audit(db, principal.userId, 'rickshaw.created', 'rickshaw', result.rows[0].id, request);
    return reply.code(201).send({ data: result.rows[0] });
  });

  app.get('/api/v1/inspections/templates/current', async (request) => {
    await principalFor(request, config, oidc, db);
    const templates = await db.query('SELECT id, version, vehicle_type, schema_json, effective_from, effective_to FROM inspection_templates WHERE active = true AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now()) ORDER BY effective_from DESC');
    return { data: templates.rows };
  });

  app.post('/api/v1/admin/inspection-templates', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['central_administrator']);
    const input = templateInput.parse(parseJson(request));
    const result = await db.query<{ id: string; version: string }>('INSERT INTO inspection_templates (version, vehicle_type, schema_json, effective_from, effective_to) VALUES ($1, $2, $3, $4, $5) RETURNING id, version', [input.version, input.vehicle_type, input.schema_json, input.effective_from, input.effective_to ?? null]);
    await audit(db, principal.userId, 'inspection_template.created', 'inspection_template', result.rows[0].id, request);
    return reply.code(201).send({ data: result.rows[0] });
  });

  app.post('/api/v1/inspections', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['inspector']);
    const input = inspectionInput.parse(parseJson(request));
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 128) return reply.code(400).send({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key is required for inspection submissions.', request_id: request.id } });
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest();
    const reservation = await db.query<{ id: string; status: string; request_hash: Buffer; response_status: number | null; response_json: unknown }>(
      'INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO NOTHING RETURNING id, status, request_hash, response_status, response_json', [principal.userId, idempotencyKey, requestHash]
    );
    if (!reservation.rows[0]) {
      const existing = await db.query<{ status: string; request_hash: Buffer; response_status: number | null; response_json: unknown }>('SELECT status, request_hash, response_status, response_json FROM idempotency_keys WHERE user_id = $1 AND key = $2', [principal.userId, idempotencyKey]);
      const row = existing.rows[0];
      if (!row || !timingSafeEqual(Buffer.from(row.request_hash), requestHash)) return reply.code(409).send({ error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'The idempotency key does not match the original request.', request_id: request.id } });
      if (row.status === 'processing') return reply.code(409).send({ error: { code: 'REQUEST_IN_PROGRESS', message: 'The original request is still being processed.', request_id: request.id } });
      return reply.code(row.response_status ?? 200).send(row.response_json);
    }
    const outcome = await db.transaction(async (transaction) => {
      const vehicle = await transaction.query<{ district_id: string; zone_id: string; owner_phone_encrypted: Buffer }>('SELECT district_id, zone_id, owner_phone_encrypted FROM rickshaws WHERE id = $1 FOR UPDATE', [input.rickshaw_id]);
      if (!vehicle.rows[0]) return null;
      requireZoneAccess(principal, vehicle.rows[0].district_id, vehicle.rows[0].zone_id);
      const inspection = await transaction.query<{ id: string }>('INSERT INTO inspections (rickshaw_id, inspector_id, template_id, checklist_data, result, status, client_timestamp, submitted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id', [input.rickshaw_id, principal.userId, input.template_id, input.checklist_data, input.result, input.result === 'pass' ? 'passed' : 'failed', input.client_timestamp ?? null]);
      let bill: { bill_code: string; expires_at: Date } | null = null;
      if (input.result === 'pass') {
        await transaction.query("UPDATE rickshaws SET status = 'pre_approved', version = version + 1, updated_at = now() WHERE id = $1", [input.rickshaw_id]);
        const created = await transaction.query<{ bill_code: string; expires_at: Date }>("INSERT INTO bills (bill_code, rickshaw_id, inspection_id, amount_paisa, expires_at, fee_rule_version) VALUES ($1, $2, $3, $4, now() + interval '48 hours', $5) RETURNING bill_code, expires_at", [billCode(), input.rickshaw_id, inspection.rows[0].id, 50000, 'v1']);
        bill = created.rows[0];
        await transaction.query("INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload) VALUES ('payment.instructions.requested', 'bill', $1, $2)", [inspection.rows[0].id, { bill_code: bill.bill_code, rickshaw_id: input.rickshaw_id }]);
        await transaction.query("INSERT INTO notification_jobs (type, recipient_encrypted, payload) VALUES ('payment_instructions', $1, $2)", [vehicle.rows[0].owner_phone_encrypted, { bill_code: bill.bill_code, amount_paisa: 50000, expires_at: bill.expires_at }]);
      }
      return { inspectionId: inspection.rows[0].id, bill };
    });
    if (!outcome) {
      const response = { error: { code: 'NOT_FOUND', message: 'Rickshaw not found.', request_id: request.id } };
      await db.query("UPDATE idempotency_keys SET status = 'completed', response_status = 404, response_json = $1, completed_at = now() WHERE user_id = $2 AND key = $3", [response, principal.userId, idempotencyKey]);
      return reply.code(404).send(response);
    }
    await audit(db, principal.userId, 'inspection.submitted', 'inspection', outcome.inspectionId, request);
    const response = { data: { inspection_id: outcome.inspectionId, bill: outcome.bill } };
    await db.query("UPDATE idempotency_keys SET status = 'completed', response_status = 201, response_json = $1, completed_at = now() WHERE user_id = $2 AND key = $3", [response, principal.userId, idempotencyKey]);
    return reply.code(201).send(response);
  });

  app.post('/api/v1/inspections/:id/void', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['hub_supervisor', 'district_administrator', 'central_administrator']);
    const inspectionId = z.string().uuid().parse((request.params as { id: string }).id);
    const input = reasonInput.parse(parseJson(request));
    const outcome = await db.transaction(async (transaction) => {
      const inspection = await transaction.query<{ status: string; rickshaw_id: string; district_id: string; zone_id: string }>(
        'SELECT i.status, i.rickshaw_id, r.district_id, r.zone_id FROM inspections i JOIN rickshaws r ON r.id = i.rickshaw_id WHERE i.id = $1 FOR UPDATE', [inspectionId]
      );
      const row = inspection.rows[0];
      if (!row) return { outcome: 'not_found' as const };
      requireZoneAccess(principal, row.district_id, row.zone_id);
      if (row.status === 'voided') return { outcome: 'already_voided' as const };
      if (row.status !== 'passed' && row.status !== 'failed') return { outcome: 'invalid_state' as const };
      await transaction.query("UPDATE inspections SET status = 'voided', void_reason = $2, voided_at = now(), voided_by = $3, updated_at = now() WHERE id = $1", [inspectionId, input.reason_code, principal.userId]);
      // Only an unpaid bill and a rickshaw not yet certified off this
      // inspection are safe to unwind automatically; a paid bill or issued
      // certificate needs the explicit reversal/revocation workflow instead
      // (a hub_supervisor can void but is not authorized to revoke a
      // certificate, so this must never auto-cascade into one). Flag it
      // instead so the caller knows manual follow-up is required.
      await transaction.query("UPDATE bills SET status = 'expired' WHERE inspection_id = $1 AND status = 'unpaid'", [inspectionId]);
      await transaction.query("UPDATE rickshaws SET status = 'pending', updated_at = now() WHERE id = $1 AND status = 'pre_approved'", [row.rickshaw_id]);
      // The rickshaw's current status alone isn't enough to decide this: it
      // could be 'certified' from a completely unrelated inspection (this
      // one voided, that one still valid). Trace precisely instead — the
      // certificate's bill_id (which propagates through renewals) points
      // back to the exact bill, and the bill to the exact inspection, that
      // produced it.
      const certificate = await transaction.query<{ id: string; short_code: string }>(
        "SELECT c.id, c.short_code FROM certificates c JOIN bills b ON b.id = c.bill_id WHERE b.inspection_id = $1 AND c.status = 'active'", [inspectionId]
      );
      return { outcome: 'voided' as const, certificate: certificate.rows[0] ?? null };
    });
    if (outcome.outcome === 'not_found') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Inspection not found.', request_id: request.id } });
    if (outcome.outcome === 'invalid_state') return reply.code(409).send({ error: { code: 'INVALID_STATE', message: 'Only a passed or failed inspection can be voided.', request_id: request.id } });
    if (outcome.outcome === 'already_voided') return { data: { voided: true, duplicate: true } };
    const certificateActionRequired = outcome.certificate !== null;
    // Recorded on the audit event itself (not just the HTTP response) so a
    // manual-follow-up flag can't be lost if the caller doesn't act on it
    // synchronously — it stays queryable in audit_events.
    await audit(db, principal.userId, 'inspection.voided', 'inspection', inspectionId, request, { certificate_action_required: certificateActionRequired, certificate_short_code: outcome.certificate?.short_code ?? null });
    return { data: { voided: true, certificate_action_required: certificateActionRequired, certificate_short_code: outcome.certificate?.short_code ?? null } };
  });

  app.post('/api/v1/webhooks/mfs/:provider', async (request, reply) => {
    const raw = typeof request.body === 'string' ? request.body : '';
    const supplied = request.headers['x-erf-signature'];
    const expected = createHmac('sha256', config.MFS_WEBHOOK_SECRET).update(raw).digest('hex');
    if (typeof supplied !== 'string' || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return reply.code(401).send({ error: { code: 'INVALID_SIGNATURE', message: 'Signature validation failed.', request_id: request.id } });
    const input = callbackInput.parse(JSON.parse(raw));
    const provider = z.string().min(1).max(32).parse((request.params as { provider: string }).provider);

    if (input.status === 'paid') {
      const outcome = await db.transaction(async (transaction) => {
        const existing = await transaction.query<{ id: string }>('SELECT id FROM payments WHERE provider = $1 AND provider_transaction_id = $2', [provider, input.transaction_id]);
        if (existing.rows[0]) return { duplicate: true as const, shortCode: null };
        const bill = await transaction.query<{ id: string; rickshaw_id: string; amount_paisa: string; status: string }>('SELECT id, rickshaw_id, amount_paisa, status FROM bills WHERE bill_code = $1 FOR UPDATE', [input.bill_code]);
        const row = bill.rows[0];
        if (!row || row.status !== 'unpaid' || Number(row.amount_paisa) !== input.amount_paisa) return { invalid: true as const };
        const vehicle = await transaction.query<{ chassis_number: string; zone_code: string; owner_phone_encrypted: Buffer }>('SELECT r.chassis_number, z.code AS zone_code, r.owner_phone_encrypted FROM rickshaws r JOIN zones z ON z.id = r.zone_id WHERE r.id = $1', [row.rickshaw_id]);
        if (!vehicle.rows[0]) return { invalid: true as const };
        await transaction.query("INSERT INTO payments (bill_id, provider, provider_transaction_id, callback_event_id, amount_paisa, status, paid_at) VALUES ($1, $2, $3, $4, $5, 'paid', now())", [row.id, provider, input.transaction_id, input.event_id, input.amount_paisa]);
        await transaction.query("UPDATE bills SET status = 'paid' WHERE id = $1", [row.id]);
        await transaction.query("UPDATE rickshaws SET status = 'certified', updated_at = now() WHERE id = $1", [row.rickshaw_id]);
        const certificate = await issueCertificate(transaction, signer, config.QR_SIGNING_KEY_ID, row.rickshaw_id, vehicle.rows[0].chassis_number, vehicle.rows[0].zone_code, row.id);
        await transaction.query("INSERT INTO notification_jobs (type, recipient_encrypted, payload) VALUES ('certificate_issued', $1, $2)", [vehicle.rows[0].owner_phone_encrypted, { certificate_short_code: certificate.shortCode }]);
        return { duplicate: false as const, shortCode: certificate.shortCode };
      });
      if (outcome.duplicate) return { data: { accepted: true, duplicate: true } };
      if ('invalid' in outcome && outcome.invalid) return reply.code(409).send({ error: { code: 'PAYMENT_NOT_ACCEPTED', message: 'The payment could not be matched to an unpaid bill.', request_id: request.id } });
      return { data: { accepted: true, certificate_short_code: outcome.shortCode } };
    }

    if (input.status === 'failed') {
      // A failed attempt is recorded for reconciliation visibility but does
      // not change the bill: the owner may retry payment before it expires.
      const outcome = await db.transaction(async (transaction) => {
        const existing = await transaction.query<{ id: string }>('SELECT id FROM payments WHERE provider = $1 AND provider_transaction_id = $2', [provider, input.transaction_id]);
        if (existing.rows[0]) return { duplicate: true as const };
        const bill = await transaction.query<{ id: string; amount_paisa: string }>('SELECT id, amount_paisa FROM bills WHERE bill_code = $1 FOR UPDATE', [input.bill_code]);
        if (!bill.rows[0] || Number(bill.rows[0].amount_paisa) !== input.amount_paisa) return { invalid: true as const };
        await transaction.query("INSERT INTO payments (bill_id, provider, provider_transaction_id, callback_event_id, amount_paisa, status) VALUES ($1, $2, $3, $4, $5, 'failed')", [bill.rows[0].id, provider, input.transaction_id, input.event_id, input.amount_paisa]);
        return { duplicate: false as const };
      });
      if (outcome.invalid) return reply.code(409).send({ error: { code: 'PAYMENT_NOT_ACCEPTED', message: 'The payment could not be matched to a known bill.', request_id: request.id } });
      return { data: { accepted: true, outcome: 'failed', duplicate: outcome.duplicate } };
    }

    // input.status === 'reversed': the provider is reversing a previously
    // paid transaction. Any certificate already issued off that payment is
    // revoked immediately — there is no human actor for this event, so the
    // revocation is recorded with a null actor (see certificate_revocations).
    const outcome = await db.transaction(async (transaction) => {
      const payment = await transaction.query<{ id: string; bill_id: string; status: string; amount_paisa: string }>('SELECT id, bill_id, status, amount_paisa FROM payments WHERE provider = $1 AND provider_transaction_id = $2 FOR UPDATE', [provider, input.transaction_id]);
      const row = payment.rows[0];
      if (!row) return { invalid: true as const };
      if (row.status === 'reversed') return { duplicate: true as const, billId: row.bill_id };
      if (row.status !== 'paid' || Number(row.amount_paisa) !== input.amount_paisa) return { invalid: true as const };
      await transaction.query("UPDATE payments SET status = 'reversed' WHERE id = $1", [row.id]);
      await transaction.query("UPDATE bills SET status = 'reversed' WHERE id = $1", [row.bill_id]);
      const bill = await transaction.query<{ rickshaw_id: string }>('SELECT rickshaw_id FROM bills WHERE id = $1', [row.bill_id]);
      const rickshawId = bill.rows[0]?.rickshaw_id;
      // Target the certificate whose lineage actually traces back to this
      // bill (bill_id propagates through renewals), not "whatever is
      // currently active for the rickshaw" — which could be an unrelated
      // later re-certification under a different bill entirely.
      const certificate = await transaction.query<{ id: string }>("SELECT id FROM certificates WHERE bill_id = $1 AND status = 'active' FOR UPDATE", [row.bill_id]);
      if (certificate.rows[0]) {
        await transaction.query("UPDATE certificates SET status = 'revoked' WHERE id = $1", [certificate.rows[0].id]);
        if (rickshawId) await transaction.query("UPDATE rickshaws SET status = 'suspended', updated_at = now() WHERE id = $1", [rickshawId]);
        await transaction.query('INSERT INTO certificate_revocations (certificate_id, reason_code, revoked_by) VALUES ($1, $2, NULL)', [certificate.rows[0].id, 'payment_reversed']);
      } else if (rickshawId) {
        // certificates.bill_id is only populated going forward (see
        // 0013_certificate_bill_lineage.sql) — a certificate issued before
        // that migration has bill_id NULL and can't be matched here. Don't
        // guess by falling back to "whatever is active for the rickshaw"
        // (that's the exact bug this bill_id lookup exists to avoid); flag
        // it for manual reconciliation instead of silently doing nothing.
        const legacyCertificate = await transaction.query<{ id: string }>("SELECT id FROM certificates WHERE rickshaw_id = $1 AND status = 'active' AND bill_id IS NULL", [rickshawId]);
        if (legacyCertificate.rows[0]) request.log.warn({ rickshawId, billId: row.bill_id, certificateId: legacyCertificate.rows[0].id }, 'payment reversed but the active certificate predates bill_id lineage tracking; revoke it manually if this reversal applies to it');
      }
      return { duplicate: false as const, billId: row.bill_id };
    });
    if ('invalid' in outcome && outcome.invalid) return reply.code(409).send({ error: { code: 'PAYMENT_NOT_ACCEPTED', message: 'The payment could not be matched to a known paid transaction.', request_id: request.id } });
    if (!outcome.duplicate) await audit(db, null, 'payment.reversed', 'bill', outcome.billId, request);
    return { data: { accepted: true, outcome: 'reversed', duplicate: outcome.duplicate } };
  });

  app.post('/api/v1/webhooks/sms/:provider', async (request, reply) => {
    const raw = typeof request.body === 'string' ? request.body : '';
    const supplied = request.headers['x-erf-signature'];
    const expected = createHmac('sha256', config.SMS_WEBHOOK_SECRET).update(raw).digest('hex');
    if (typeof supplied !== 'string' || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return reply.code(401).send({ error: { code: 'INVALID_SIGNATURE', message: 'Signature validation failed.', request_id: request.id } });
    const input = smsStatusInput.parse(JSON.parse(raw));
    const updated = await db.query<{ id: string }>("UPDATE notification_jobs SET status = $1, last_error = $2 WHERE provider_message_id = $3 RETURNING id", [input.status, input.error ?? null, input.provider_message_id]);
    if (!updated.rows[0]) return reply.code(404).send({ error: { code: 'MESSAGE_NOT_FOUND', message: 'The provider message was not found.', request_id: request.id } });
    return { data: { accepted: true } };
  });

  app.get('/api/v1/verifier/keys', async () => ({ data: signer.publicManifest() }));

  app.post('/api/v1/admin/certificates/:id/revoke', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['district_administrator', 'central_administrator']);
    const certificateId = z.string().uuid().parse((request.params as { id: string }).id);
    const input = reasonInput.parse(parseJson(request));
    const outcome = await db.transaction(async (transaction) => {
      const certificate = await transaction.query<{ rickshaw_id: string; district_id: string; zone_id: string; status: string }>('SELECT c.rickshaw_id, r.district_id, r.zone_id, c.status FROM certificates c JOIN rickshaws r ON r.id = c.rickshaw_id WHERE c.id = $1 FOR UPDATE', [certificateId]);
      const row = certificate.rows[0];
      if (!row) return 'not_found' as const;
      requireZoneAccess(principal, row.district_id, row.zone_id);
      if (row.status === 'revoked') return 'already_revoked' as const;
      await transaction.query("UPDATE certificates SET status = 'revoked' WHERE id = $1", [certificateId]);
      await transaction.query("UPDATE rickshaws SET status = 'suspended', updated_at = now() WHERE id = $1", [row.rickshaw_id]);
      await transaction.query('INSERT INTO certificate_revocations (certificate_id, reason_code, revoked_by) VALUES ($1, $2, $3)', [certificateId, input.reason_code, principal.userId]);
      return 'revoked' as const;
    });
    if (outcome === 'not_found') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Certificate not found.', request_id: request.id } });
    if (outcome === 'already_revoked') return { data: { revoked: true, duplicate: true } };
    await audit(db, principal.userId, 'certificate.revoked', 'certificate', certificateId, request);
    return { data: { revoked: true } };
  });

  app.post('/api/v1/admin/certificates/:id/renew', async (request, reply) => {
    const principal = await principalFor(request, config, oidc, db);
    requireRole(principal, ['district_administrator', 'central_administrator']);
    const certificateId = z.string().uuid().parse((request.params as { id: string }).id);
    const outcome = await db.transaction(async (transaction) => {
      const certificate = await transaction.query<{ status: string; rickshaw_id: string; district_id: string; zone_id: string; chassis_number: string; zone_code: string; owner_phone_encrypted: Buffer; superseded_by_certificate_id: string | null; bill_id: string | null }>(
        `SELECT c.status, c.rickshaw_id, r.district_id, r.zone_id, r.chassis_number, z.code AS zone_code, r.owner_phone_encrypted, c.superseded_by_certificate_id, c.bill_id
         FROM certificates c JOIN rickshaws r ON r.id = c.rickshaw_id JOIN zones z ON z.id = r.zone_id WHERE c.id = $1 FOR UPDATE`, [certificateId]
      );
      const row = certificate.rows[0];
      if (!row) return { outcome: 'not_found' as const };
      requireZoneAccess(principal, row.district_id, row.zone_id);
      if (row.status === 'superseded' && row.superseded_by_certificate_id) {
        // Walk the full supersession chain, not just one hop: this
        // certificate may itself have been renewed again since, in which
        // case its immediate successor is no longer the current one either.
        const chain = await transaction.query<{ short_code: string }>(
          `WITH RECURSIVE chain AS (
             SELECT id, short_code, superseded_by_certificate_id FROM certificates WHERE id = $1
             UNION ALL
             SELECT c.id, c.short_code, c.superseded_by_certificate_id FROM certificates c JOIN chain ON c.id = chain.superseded_by_certificate_id
           )
           SELECT short_code FROM chain WHERE superseded_by_certificate_id IS NULL`, [row.superseded_by_certificate_id]
        );
        return { outcome: 'duplicate' as const, shortCode: chain.rows[0]?.short_code ?? null };
      }
      if (row.status !== 'active') return { outcome: 'invalid_state' as const };
      const issued = await issueCertificate(transaction, signer, config.QR_SIGNING_KEY_ID, row.rickshaw_id, row.chassis_number, row.zone_code, row.bill_id);
      await transaction.query('UPDATE certificates SET status = $1, superseded_by_certificate_id = $2 WHERE id = $3', ['superseded', issued.id, certificateId]);
      await transaction.query("INSERT INTO notification_jobs (type, recipient_encrypted, payload) VALUES ('certificate_issued', $1, $2)", [row.owner_phone_encrypted, { certificate_short_code: issued.shortCode }]);
      return { outcome: 'renewed' as const, shortCode: issued.shortCode };
    });
    if (outcome.outcome === 'not_found') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Certificate not found.', request_id: request.id } });
    if (outcome.outcome === 'invalid_state') return reply.code(409).send({ error: { code: 'INVALID_STATE', message: 'Only an active certificate can be renewed.', request_id: request.id } });
    if (outcome.outcome === 'duplicate') return { data: { renewed: true, duplicate: true, certificate_short_code: outcome.shortCode } };
    await audit(db, principal.userId, 'certificate.renewed', 'certificate', certificateId, request);
    return { data: { renewed: true, certificate_short_code: outcome.shortCode } };
  });

  app.post('/api/v1/public/verify/qr', async (request, reply) => {
    const input = z.object({ token: z.string().min(1) }).parse(parseJson(request));
    const payload = signer.validate(input.token);
    if (!payload) return reply.code(400).send({ data: { valid: false, reason: 'invalid_signature' } });
    return { data: { valid: payload.exp >= Math.floor(Date.now() / 1000), live_status_checked: false, payload } };
  });
  app.get('/api/v1/public/verify/:shortCode', async (request, reply) => {
    const result = await db.query<{ certificate_number: string; expires_at: Date; status: string; chassis_number: string; zone: string }>("SELECT c.certificate_number, c.expires_at, c.status, r.chassis_number, z.code AS zone FROM certificates c JOIN rickshaws r ON r.id = c.rickshaw_id JOIN zones z ON z.id = r.zone_id WHERE c.short_code = $1", [(request.params as { shortCode: string }).shortCode]);
    const certificate = result.rows[0];
    if (!certificate) return reply.code(404).send({ data: { valid: false, reason: 'not_found' } });
    return { data: { valid: certificate.status === 'active' && certificate.expires_at > new Date(), certificate_number: certificate.certificate_number, chassis_suffix: certificate.chassis_number.slice(-4), zone: certificate.zone, expires_at: certificate.expires_at, status: certificate.status } };
  });
  app.get('/api/v1/public/certificates/:shortCode.pdf', async (request, reply) => {
    const shortCode = z.string().min(1).max(32).parse((request.params as { shortCode: string }).shortCode);
    const result = await db.query<{ certificate_number: string; expires_at: Date; status: string; chassis_number: string; zone: string; qr_payload: string | null }>("SELECT c.certificate_number, c.expires_at, c.status, c.qr_payload, r.chassis_number, z.code AS zone FROM certificates c JOIN rickshaws r ON r.id = c.rickshaw_id JOIN zones z ON z.id = r.zone_id WHERE c.short_code = $1", [shortCode]);
    const certificate = result.rows[0];
    if (!certificate) return reply.code(404).send({ data: { found: false } });
    if (!certificate.qr_payload) return reply.code(409).send({ error: { code: 'QR_NOT_READY', message: 'The certificate QR payload is not ready.', request_id: request.id } });
    const pdf = await renderCertificatePdf({ certificateNumber: certificate.certificate_number, chassisSuffix: certificate.chassis_number.slice(-4), zone: certificate.zone, status: certificate.status, expiresAt: certificate.expires_at, verificationUrl: `/api/v1/public/verify/${shortCode}`, qrPayload: certificate.qr_payload });
    return reply.header('Content-Type', 'application/pdf').header('Content-Disposition', `inline; filename="${certificate.certificate_number}.pdf"`).send(pdf);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthenticationError) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: error.message, request_id: request.id } });
    if (error instanceof AuthorizationError) return reply.code(403).send({ error: { code: 'OUT_OF_SCOPE', message: error.message, request_id: request.id } });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'The request data is invalid.', request_id: request.id } });
    request.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', request_id: request.id } });
  });
}

async function audit(db: Database, actorId: string | null, action: string, entityType: string, entityId: string, request: FastifyRequest, afterJson: Record<string, unknown> | null = null): Promise<void> {
  await db.query('INSERT INTO audit_events (actor_id, action, entity_type, entity_id, request_id, ip, after_json) VALUES ($1, $2, $3, $4, $5, $6, $7)', [actorId, action, entityType, entityId, request.id, request.ip, afterJson]);
}
