# Local infrastructure

Start PostgreSQL, Redis, and RabbitMQ for local development:

```powershell
docker compose up -d
```

PostgreSQL applies `postgres/init/0001_core_schema.sql` only when its data volume is first created. For an intentional clean local reset, stop the stack and remove the explicitly named `postgres_data` volume before starting it again.

`0002_development_seed.sql` creates a deterministic development district, zone, inspector, and checklist template. It is for local use only and must not be loaded in production.

For an existing environment, run `npm.cmd --workspace @erf/api run db:migrate` from the repository root. The migration runner records applied files in `schema_migrations` and safely handles databases bootstrapped before that table existed.

For a containerized staging smoke deployment, copy `.env.staging.example` to `.env.staging`, replace every placeholder through a secret manager, then run `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build`. The API container runs migrations before starting and exposes a health check at `/health/live`.

RabbitMQ management is available at `http://localhost:15672` using `erf` / `erf_dev_password`. These development credentials must never be used outside local development.

## Staging checklist

Use a secret-managed `.env.staging` based on `.env.staging.example`; set OIDC issuer/audience and `OIDC_ENABLED=true`, provider MFS/SMS secrets, and non-default database credentials. Register HTTPS MFS and SMS callback URLs with the providers and allow only their documented source IPs/mTLS certificates. Do not use development JWT, signer, seed data, or RabbitMQ credentials.

The staging API runs migrations before startup. For an already-provisioned database, run `npm.cmd --workspace @erf/api run db:migrate`; migrations are ordered by filename and tracked in `schema_migrations`. Check `docker compose --env-file .env.staging -f docker-compose.staging.yml ps`, `/health/live`, and `/health/ready` before testing.

CI is defined in `.github/workflows/ci.yml` and must pass lint, tests, builds, audit, and the container build before promoting a staging image.
