import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as load } from 'dotenv';

export function loadDotEnv(): void {
  const current = join(process.cwd(), '.env');
  const repository = join(process.cwd(), '..', '..', '.env');
  load({ path: existsSync(current) ? current : repository });
}
