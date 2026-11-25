import { Pool, types, type QueryResult, type QueryResultRow } from 'pg';
import { config } from './config';
import { SCHEMA_SQL } from './schema';

// Return DATE columns as 'YYYY-MM-DD' strings and NUMERIC as numbers
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1700, (v: string) => parseFloat(v));

const isLocal = /localhost|127\.0\.0\.1/.test(config.databaseUrl);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export async function initDb(): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
