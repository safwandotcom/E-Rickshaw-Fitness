# Implementation Plan

## Delivery approach

Use iterative pilot delivery with production-quality security foundations from the start. The target sequence below is expressed in phases rather than calendar dates because completion depends on legal approvals, provider sandbox access, inspection-policy finalization, and field-hardware procurement.

## Phase 0 — Discovery and governance

**Outcome:** Approved policies, measurable pilot scope, and integration readiness.

- Confirm the lead authority, participating hubs, districts/zones, roles, and escalation owners.
- Finalize inspection checklist, fee rules, certificate validity, renewal policy, revocation reasons, and exception approvals.
- Obtain MFS/Ekpay and SMS gateway documentation, sandbox accounts, webhook IP ranges/mTLS requirements, and settlement process.
- Define PII classification, retention schedule, audit requirements, incident response, and public-verification disclosure policy.
- Select hosting, domain, KMS/HSM, object storage, monitoring, and support model.

**Exit criteria:** signed product requirements; provider sandbox access; approved checklist v1; pilot hubs and success metrics defined.

## Phase 1 — Foundation and security baseline

**Outcome:** Deployable, observable foundation with secure identity and core schema.

- Create repositories, branching/review policy, CI pipelines, container builds, IaC, development/staging environments, and secret management.
- Implement OIDC identity, MFA for privileged roles, RBAC/geographic authorization, audit event framework, API error format, and OpenAPI contract.
- Implement PostgreSQL migrations, core tables, transactional outbox, RabbitMQ topology, Redis, object storage access, backups, and health checks.
- Establish log redaction, metrics dashboards, traces, alert thresholds, dependency/secret scanning, and threat-model review.

**Exit criteria:** a reviewer can deploy to staging, sign in with assigned scope, create audited test data, and recover a test database backup.

## Phase 2 — Inspector workflow and offline PWA

**Outcome:** Inspectors can execute the complete inspection workflow reliably.

- Build responsive Bangla-first PWA shell, authenticated session flow, vehicle search/registration, checklist templates, validation, evidence attachment, and submission review.
- Add IndexedDB draft/outbox storage, sync manager, idempotency keys, conflict handling, cached templates and zones, and clear offline state indicators.
- Implement inspection server APIs, template versioning, state transitions, supervisor exception views, and district-scoped reporting.
- Conduct usability testing at one hub with real inspectors and poor-network simulations.

**Exit criteria:** an offline inspection syncs exactly once after reconnecting; unauthorized cross-zone access is rejected; pilot users complete a scripted inspection without assisted data entry.

## Phase 3 — Billing, provider integration, and notifications

**Outcome:** Passing inspections create secure bills and verified payments.

- Implement bill generation, expiration scheduler, fee-rule versioning, payment state machine, finance dashboard, and reconciliation report.
- Integrate provider sandbox webhooks with exact HMAC/mTLS validation, replay protection, raw-event retention, duplicate-event handling, and provider-to-bill matching.
- Implement SMS worker, localized approved templates, retries/backoff, delivery tracking, and dead-letter review flow.
- Test negative scenarios: altered signature, wrong amount, expired bill, duplicate callback, delayed callback, provider outage, and SMS outage.

**Exit criteria:** repeated callback delivery cannot issue duplicate certificates; every callback is traceable; reconciliation identifies unmatched or anomalous transactions.

## Phase 4 — Certificates and police verification

**Outcome:** Certificates are issued and verifiable in the field, including offline.

- Build certificate numbering, short-code service, PDF renderer, private download links, and certificate lifecycle/revocation controls.
- Integrate Ed25519 KMS/HSM signing; publish signed public-key manifest and key rotation procedure.
- Build police verifier PWA/native scanner with QR scanning, offline CBOR/signature validation, clock/freshness warnings, online live verification, and minimum-data display.
- Validate sticker size, error correction, print quality, UV/waterproof material choice, and scan rates on representative devices.

**Exit criteria:** a clean offline verifier validates a genuine sticker and rejects a modified payload; online scan immediately reflects revocation; key rotation drill succeeds.

## Phase 5 — Pilot, hardening, and launch

**Outcome:** Controlled production pilot and scale decision.

- Run a limited pilot by hub/district behind feature flags; provide field training, support runbook, and daily operational review.
- Execute load, penetration, accessibility, disaster-recovery, offline-sync, and end-to-end provider tests.
- Monitor certificate throughput, payment match rate, SMS delivery, queue latency, scan outcomes, inspector completion time, and security events.
- Resolve pilot issues, document standard operating procedures, approve rollout readiness, and expand incrementally.

**Exit criteria:** pilot acceptance criteria in the specification are met, no critical security findings remain open, support staff can execute recovery/revocation workflows, and governance approves expansion.

## Workstreams and ownership

| Workstream | Main deliverables | Suggested owner |
| --- | --- | --- |
| Product & policy | Checklists, fee/certificate policy, acceptance criteria, training | Authority product owner |
| Platform backend | APIs, workflows, database, workers, integrations | Backend team lead |
| Web/mobile | Inspector PWA, admin portal, verifier app | Frontend/mobile lead |
| Security & platform | IAM, KMS, IaC, observability, reviews, DR | Security/DevOps lead |
| Payments & finance | Provider integration, reconciliation, settlement exceptions | Finance integration lead |
| Field operations | Printers, stickers, hub process, support and rollout | Operations lead |

## Initial backlog (priority order)

1. Repository, CI/CD, environment configuration, secrets, and observability.
2. Authentication, users, roles, geographic assignments, and audit logging.
3. Vehicle registry and versioned inspection templates.
4. Inspector PWA online inspection flow.
5. Offline drafts, submission outbox, and robust sync.
6. Passing-inspection state transition and bill creation.
7. SMS payment notification and delivery tracking.
8. MFS provider callback verification, payment idempotency, and reconciliation console.
9. Certificate generation, short links, signed QR payload, and PDF rendering.
10. Police verifier offline cryptographic validation and online status lookup.
11. Revocation, renewal, reporting, exports, alerting, and operational runbooks.

## Test strategy

| Level | Focus |
| --- | --- |
| Unit | State transitions, checklist rules, authorization policies, canonical QR encoding, signature verification, bill expiry. |
| Integration | Database constraints, outbox-to-queue delivery, MFS signature callbacks, SMS retries, KMS signing. |
| Contract | OpenAPI clients, MFS/SMS provider payloads, public-key manifest compatibility. |
| End-to-end | Online and offline inspection to payment to certificate to roadside scan. |
| Security | SAST/DAST, dependency scan, access-control tests, webhook replay/tampering, pen test before launch. |
| Performance | API/verification burst traffic, queue backlog, database capacity, degraded provider behavior. |
| Field/UAT | Device matrix, scanner quality, Bangla usability, intermittent connectivity, printer/sticker durability. |

## Key risks and mitigations

| Risk | Mitigation |
| --- | --- |
| MFS provider callback variations or delayed settlement | Contract tests, idempotency, durable callback ledger, daily reconciliation, provider escalation runbook. |
| Fraudulent approvals | Geographic authorization, immutable submissions, supervisor review, audit alerts, strict exception policy. |
| QR cloning or altered stickers | Ed25519 signatures, tamper-evident material, online revocation, renewal/replacement audit trail. |
| Offline device compromise or stale keys | Expiring authenticated offline window, key-manifest freshness indicator, device management policy, online checks when available. |
| Connectivity failure at hubs | Local outbox, background sync, operator-visible reconciliation, paper fallback procedure during incidents. |
| Sensitive-data exposure | Data minimization, encryption, masking, least privilege, redacted logs, security testing. |
| Premature microservices complexity | Begin modular; extract only workloads with independent scaling/ownership needs and stable contracts. |

## Decisions needed before build begins

- Whether React PWA or Flutter is preferred for inspector and verifier clients; React PWA is recommended for faster shared web delivery unless native scanner/device controls dictate Flutter.
- Whether Go or Node.js is preferred for the API; Go is recommended where the delivery team has comparable expertise and wants compact concurrency-oriented services, otherwise choose the team’s strongest maintained stack.
- Approved MFS aggregator/provider, webhook security contract, and settlement/reversal policy.
- Certificate validity period, renewal lead time, statutory fee schedule, and revocation authority.
- Hosting/data-residency requirements, KMS/HSM availability, and incident-response ownership.
