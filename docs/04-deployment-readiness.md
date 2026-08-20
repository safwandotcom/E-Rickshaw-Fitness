# Deployment Readiness and External Integration Checklist

## Implemented MVP capabilities

- React PWA with a template-driven inspection checklist (fields render from the active `inspection_templates.schema_json`, required reason on a failed check), IndexedDB offline outbox, background service-worker shell cache, and offline Ed25519 QR signature verification.
- Real OIDC Authorization Code + PKCE sign-in in the PWA (`VITE_OIDC_*`), falling back to the manual development bearer-token field when unconfigured. The API's OIDC verifier checks only the token signature/issuer/audience/subject — roles and geographic scope always come from local provisioning, never from token claims.
- Fastify API with JWT/OIDC validation, RBAC/geographic authorization primitives, API rate limits, request IDs, health endpoints, validation, and structured error responses.
- PostgreSQL schema for users/roles/scopes, vehicles, inspections, billing, payments, certificates, outbox events, domain events, and audit events.
- Passing-inspection to payment-bill transition; HMAC-verified MFS callback (`paid`/`failed`/`reversed`) to idempotent payment/certificate transition. A `reversed` callback revokes any certificate already issued off that payment. A finance/central-admin `GET /api/v1/admin/reconciliation` endpoint and matching PWA panel list failed/reversed payments and other exceptions.
- Backend idempotency-key reservations and replayed-response handling for offline inspection synchronization.
- Ed25519 signed QR token issuance, public-key manifest, online public certificate lookup, and offline signature validation.
- Privileged certificate revocation and renewal (supersession) with geographic authorization, audit trail, and automatic bill/certificate expiry sweeps.
- Inspection void/correction workflow (`POST /api/v1/inspections/:id/void`) for hub supervisors and above, with a required reason and automatic unwind of an unpaid bill/pre-approved rickshaw status.
- RabbitMQ outbox publisher and a durable domain-event consumer that persists every published event to an append-only `domain_events` table for support/replay, independent of the `notification_jobs` polling worker that actually sends SMS. Plus a local PostgreSQL/Redis/RabbitMQ compose environment.
- Camera-based QR capture in the verifier (`jsQR`, decoded on-device) alongside the manual paste fallback; a request-level test suite covering the vehicle registry endpoints.
- An EN/বাংলা language toggle for the PWA's static chrome (nav, headings, labels, buttons, fixed status text — not messages that embed raw API error text) plus a first accessibility pass: `aria-live` status regions, a skip-to-content link, visible focus outlines, `aria-current` on the active nav tab, and a captioned/scoped reconciliation table. The Bangla strings are a best-effort working translation, not reviewed by a native speaker — treat as a starting point before a real pilot, and get a full WCAG 2.1 AA audit (this pass is not one) before relying on it for compliance.

## Required before a production rollout

| Area | Required action | Owner |
| --- | --- | --- |
| Identity | Integrate the authority OIDC provider; remove/disable the development token endpoint; enforce MFA and account lifecycle rules. | IAM team |
| MFS | Replace the local HMAC secret with the selected provider’s exact signing, mTLS, IP allowlist, callback, settlement, reversal, and reconciliation contract. | Finance/integration team |
| SMS | Implement the approved telco adapter and approved Bangla/English templates; configure DLR callbacks and retry policy. | Operations/integration team |
| QR signing | Replace `DevelopmentQrSigner` with an HSM/KMS Ed25519 signing adapter; publish rotated signed key manifests and run a key-loss drill. | Security/platform team |
| Certificates | Attach a government-approved PDF renderer, template, storage bucket, download policy, and waterproof/tamper-evident sticker printer workflow. | Product/operations |
| Data protection | Provision managed secret storage, field-encryption keys, encrypted backups, retention policies, audit-log immutability, and access reviews. | Security/platform team |
| Infrastructure | Deploy separate staging/production environments, managed database, high availability, WAF, monitoring, alerts, and tested recovery. | DevOps team |
| Assurance | Complete load testing, vulnerability management, penetration testing, accessibility review, UAT, disaster recovery and field scanner/sticker tests. | QA/security/operations |

## Security constraints

- The generated signer is suitable only for local development because its private key is ephemeral. Production must sign in KMS/HSM and never export its private key.
- The `POST /api/v1/auth/dev-token` endpoint is intentionally available only under `NODE_ENV=development`; staging and production authentication must use an authority identity provider.
- Development Docker credentials and example secrets must never be deployed. Rotate all secrets before connecting any shared system.
- API endpoint-level checks are a foundation. Apply database role separation and row-level policy where the authority requires defense in depth.

## Validation already run

`npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd test` all pass locally. The npm audit endpoint was unreachable from this environment; run a registry-connected dependency audit in CI before release.

The restricted build environment used for this work does not permit binding a local API socket, so API runtime smoke testing must be run in a normal developer/CI environment. PostgreSQL, Redis, and RabbitMQ containers did start and report healthy status.

## Staging runbook

1. Create a staging secret-manager entry (or a protected `.env.staging` file) from `.env.staging.example`. Replace every `replace-*` value, including database/RabbitMQ credentials, JWT and encryption secrets, MFS/SMS webhook secrets, and the SMS token. Never commit this file.
2. Configure OIDC before starting the API: set `OIDC_ENABLED=true`, the exact issuer URL, and audience. Register the staging callback/origins with the authority IdP, require MFA for privileged roles, then provision each operator by external subject through `POST /api/v1/admin/users` after the first central-admin login. Unprovisioned subjects are denied.
3. Configure provider callbacks over HTTPS. Route the MFS callback to the API callback endpoint documented in `docs/openapi.yaml`; validate the provider's HMAC/mTLS/IP allowlist contract and send the raw signed body unchanged. Route SMS delivery callbacks to the SMS callback endpoint with its HMAC signature. Test duplicate event delivery and rejected signatures before enabling production credentials.
4. Start staging with migrations run before the API:

   ```powershell
   docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
   docker compose --env-file .env.staging -f docker-compose.staging.yml ps
   ```

   The container executes `node apps/api/dist/migrate.js`; migrations are applied in lexicographic order and recorded in `schema_migrations`. For an existing database, run `npm.cmd --workspace @erf/api run db:migrate` from the repository root instead of replaying init scripts. Do not load `0002_development_seed.sql` in staging or production.
5. Verify `/health/live` and `/health/ready`, then run the end-to-end test: provisioned OIDC login → inspection with an idempotency key → bill/SMS queue → signed sandbox MFS callback → certificate/PDF/QR verification → SMS delivery callback. Confirm a repeated callback does not create a second payment or certificate.

## CI and release gate

Every push to `main` and every pull request must pass `.github/workflows/ci.yml`: `npm ci`, lint, tests, production builds, high-severity dependency audit, and the API container build. A staging promotion must use the exact image and commit validated by CI, apply migrations before traffic, and retain the CI logs and migration output with the release record.
