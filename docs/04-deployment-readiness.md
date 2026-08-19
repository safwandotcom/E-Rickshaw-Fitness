# Deployment Readiness and External Integration Checklist

## Implemented MVP capabilities

- React PWA with inspector submission form, IndexedDB offline outbox, background service-worker shell cache, and offline Ed25519 QR signature verification.
- Fastify API with JWT validation, RBAC/geographic authorization primitives, API rate limits, request IDs, health endpoints, validation, and structured error responses.
- PostgreSQL schema for users/roles/scopes, vehicles, inspections, billing, payments, certificates, outbox events, and audit events.
- Passing-inspection to payment-bill transition; HMAC-verified MFS callback to idempotent payment/certificate transition.
- Backend idempotency-key reservations and replayed-response handling for offline inspection synchronization.
- Ed25519 signed QR token issuance, public-key manifest, online public certificate lookup, and offline signature validation.
- Privileged certificate revocation with geographic authorization, audit trail, and automatic bill/certificate expiry sweeps.
- RabbitMQ outbox publisher and notification-consumer foundation, plus local PostgreSQL/Redis/RabbitMQ compose environment.

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
