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
