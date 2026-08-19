import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { Database } from './db.js';

const config = loadConfig();
const db = new Database(config);
const app = await buildApp(config, db);

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await db.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: config.HOST });
