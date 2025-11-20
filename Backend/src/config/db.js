import sql from 'mssql';
import { env } from './env.js';

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect({
      server: env.sql.server,
      database: env.sql.database,
      user: env.sql.user,
      password: env.sql.password,
      options: {
        encrypt: env.sql.encrypt,
        trustServerCertificate: env.sql.trustServerCertificate,
      },
      pool: env.sql.pool,
    });
  }
  return poolPromise;
}

export async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = undefined;
  }
}
