# E-Rickshaw Fitness Certification Platform

Planning and design documents for a secure, offline-capable e-rickshaw fitness inspection, payment, certification, and roadside-verification platform.

## Documents

- [Product & Technical Specification](docs/01-product-technical-specification.md)
- [Architecture, Data, API & Security Design](docs/02-architecture-data-api-security.md)
- [Implementation Plan](docs/03-implementation-plan.md)
- [Deployment Readiness](docs/04-deployment-readiness.md)
- [OpenAPI Contract](docs/openapi.yaml)

## Scope at a glance

The platform enables authorized inspectors to record vehicle fitness inspections, owners to pay fees through mobile financial services, the authority to issue signed certificates and QR stickers, and traffic police to verify certificates online or offline.

The recommended first implementation is a modular monolith with asynchronous workers. Its modules are separated by clear interfaces so high-volume functions can be extracted into microservices later without prematurely adding operational complexity.

## Implementation status

The MVP implementation now includes a TypeScript/Fastify API, React PWA, PostgreSQL schema, signed QR verification, transaction outbox worker, and local PostgreSQL/Redis/RabbitMQ services. See [local setup](infra/README.md) for service instructions.

## Run locally

1. Copy `.env.example` to `.env` and replace all development secrets before any shared deployment.
2. Start the dependencies with `docker compose up -d`.
3. Run `npm.cmd install`, then `npm.cmd run dev:api` and `npm.cmd run dev:web` in separate terminals.
4. Run the queue worker with `npm.cmd --workspace @erf/api run worker`.
5. Apply schema changes with `npm.cmd --workspace @erf/api run db:migrate`.

Run `npm.cmd run build` and `npm.cmd test` before committing changes.

GitHub Actions validates lint, tests, builds, dependency advisories, and the API container on every push and pull request.

## Staging handoff

See [deployment readiness](docs/04-deployment-readiness.md) for the operator runbook. In brief: create `.env.staging` from the example using a secret manager, configure OIDC plus MFS/SMS callback contracts, start `docker-compose.staging.yml`, verify health endpoints, and run the full inspection-to-certificate test with duplicate webhook delivery. CI must pass before promotion; migrations run before API traffic and are tracked in `schema_migrations`.
