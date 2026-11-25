import 'dotenv/config';

// Reads and checks environment variables once, so the rest of the code gets typed values

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in environment. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT) || 4000,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
} as const;
