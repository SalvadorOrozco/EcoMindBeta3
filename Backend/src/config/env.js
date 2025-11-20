import 'dotenv/config';

const required = [
  'SQL_SERVER',
  'SQL_DATABASE',
  'SQL_USER',
  'SQL_PASSWORD',
  'JWT_SECRET',
];

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  sql: {
    server: process.env.SQL_SERVER ?? 'localhost',
    database: process.env.SQL_DATABASE ?? 'EcoMind',
    user: process.env.SQL_USER ?? 'sa',
    password: process.env.SQL_PASSWORD ?? 'YourStrong!Passw0rd',
    encrypt: (process.env.SQL_ENCRYPT ?? 'false').toLowerCase() === 'true',
    trustServerCertificate:
      (process.env.SQL_TRUST_CERT ?? 'true').toLowerCase() === 'true',
    pool: {
      max: Number.parseInt(process.env.SQL_POOL_MAX ?? '10', 10),
      min: Number.parseInt(process.env.SQL_POOL_MIN ?? '1', 10),
      idleTimeoutMillis: Number.parseInt(
        process.env.SQL_POOL_IDLE_TIMEOUT ?? '30000',
        10,
      ),
    },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    tokenExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  },
};

export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
