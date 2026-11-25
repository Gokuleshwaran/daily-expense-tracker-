// Runs before every test file. Fake values only: the real database is never contacted
// (tests mock src/db) and dotenv never overrides variables that are already set.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.CORS_ORIGIN = 'http://localhost:3000';
