import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { loadConfig } from './config.js';
import { loadDotEnv } from './env.js';

loadDotEnv();
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const migrationsDirectory = join(process.cwd(), '..', '..', 'infra', 'postgres', 'init');

await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const applied = new Set((await pool.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((row) => row.version));

// The original Docker bootstrap predates schema_migrations. Mark its schema as
// applied when it already exists, then apply all subsequent files normally.
if (!applied.has('0001_core_schema.sql')) {
  const existing = await pool.query<{ exists: string | null }>("SELECT to_regclass('public.rickshaws') AS exists");
  if (existing.rows[0]?.exists) {
    await pool.query("INSERT INTO schema_migrations (version) VALUES ('0001_core_schema.sql') ON CONFLICT DO NOTHING");
    applied.add('0001_core_schema.sql');
  }
}

for (const file of files) {
  if (applied.has(file)) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(join(migrationsDirectory, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
console.log('database is up to date');
