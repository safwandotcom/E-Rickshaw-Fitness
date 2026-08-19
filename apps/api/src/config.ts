import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  AUTH_JWT_SECRET: z.string().min(32).default('local-development-jwt-secret-change-me'),
  DATA_ENCRYPTION_SECRET: z.string().min(32).default('local-development-data-secret-change-me'),
  MFS_WEBHOOK_SECRET: z.string().min(32).default('local-development-mfs-webhook-secret'),
  QR_SIGNING_KEY_ID: z.string().min(1).default('dev-2026-01')
  ,OIDC_ENABLED: z.preprocess((value) => value === 'true', z.boolean().default(false)),
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().min(1).optional()
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment = process.env): AppConfig {
  const config = environmentSchema.parse(environment);
  if (config.NODE_ENV === 'production') {
    const localDefaults = [config.AUTH_JWT_SECRET, config.DATA_ENCRYPTION_SECRET, config.MFS_WEBHOOK_SECRET].some((secret) => secret.startsWith('local-development-') || secret.startsWith('replace-with-'));
    if (localDefaults) throw new Error('Production configuration must provide non-development secrets.');
  }
  if (config.NODE_ENV !== 'development' && (!config.OIDC_ENABLED || !config.OIDC_ISSUER_URL || !config.OIDC_AUDIENCE)) {
    throw new Error('Staging and production require OIDC_ENABLED, OIDC_ISSUER_URL, and OIDC_AUDIENCE.');
  }
  return config;
}
