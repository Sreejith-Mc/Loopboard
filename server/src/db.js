import pg from 'pg';

const { Pool } = pg;

// node-postgres returns BIGINT (oid 20) as a string to avoid precision loss.
// Loopboard stores millisecond timestamps and COUNT(*) results there, both far
// below Number.MAX_SAFE_INTEGER, and the client expects real numbers.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy your Supabase connection string (Session/Transaction pooler) ' +
    'into .env locally, and into the Vercel project environment variables for deploys.',
  );
}

// Serverless invocations reuse the same warm process, so keep one pool on the
// global object rather than opening a new one per request.
const g = globalThis;

export const pool = g.__loopboardPool ?? new Pool({
  connectionString,
  // The Supabase pooler caps connections; a small per-instance pool is correct
  // for serverless, where many instances each hold their own.
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});
g.__loopboardPool = pool;

/** Run a query, return all rows. */
export async function q(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

/** Run a query, return the first row or null. */
export async function one(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction on a single dedicated connection. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw err;
  } finally {
    client.release();
  }
}
