import pg from 'pg';
import type { AppConfig } from './config.js';

export interface Queryable {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<T>>;
}

export class Database implements Queryable {
  private readonly pool: pg.Pool;

  constructor(config: AppConfig) {
    this.pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
  }

  query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async ready(): Promise<boolean> {
    await this.query('SELECT 1');
    return true;
  }

  async transaction<T>(operation: (transaction: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
