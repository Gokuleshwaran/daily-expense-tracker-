import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appFor, authHeader, result } from '../helpers';

const { query, connect } = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock('../../src/db', () => ({ query, pool: { connect } }));

import router from '../../src/routes/auth';

const app = appFor('/api/auth', router, true);

const clientQuery = vi.fn();
const release = vi.fn();

beforeEach(() => {
  connect.mockResolvedValue({ query: clientQuery, release });
});

const userRow = (over: Record<string, unknown> = {}) => ({
  id: 3,
  email: 'asha@example.com',
  name: 'Asha',
  password_hash: 'hash',
  currency: 'INR',
  monthly_budget: null,
  created_at: new Date(),
  ...over,
});

describe('POST /api/auth/signup', () => {
  const body = { name: ' Asha ', email: ' Asha@Example.com ', password: 'secret123' };

  it.each([
    [{ email: 'a@b.com', password: 'secret123' }, 'name'],
    [{ name: 'A', password: 'secret123' }, 'email'],
    [{ name: 'A', email: 'a@b.com' }, 'password'],
  ])('returns 400 when a field is missing (%j, %s)', async (payload, _missingField) => {
    const res = await request(app).post('/api/auth/signup').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name, email and password are required');
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 400 for a password shorter than 6 characters', async () => {
    const res = await request(app).post('/api/auth/signup').send({ ...body, password: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be at least 6 characters');
  });

  it('returns 409 and rolls back when the email already exists', async () => {
    clientQuery.mockResolvedValueOnce(result([])); // BEGIN
    clientQuery.mockResolvedValueOnce(result([{ '?column?': 1 }])); // email exists
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An account with this email already exists');
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });

  it('creates the user, seeds 8 default categories and returns a token', async () => {
    clientQuery.mockResolvedValueOnce(result([])); // BEGIN
    clientQuery.mockResolvedValueOnce(result([], 0)); // email free
    clientQuery.mockResolvedValueOnce(result([userRow()])); // INSERT user
    clientQuery.mockResolvedValue(result([])); // category inserts + COMMIT

    const res = await request(app).post('/api/auth/signup').send(body);

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: 3, email: 'asha@example.com', name: 'Asha', currency: 'INR', monthly_budget: null });
    expect(res.body.user).not.toHaveProperty('password_hash');
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as jwt.JwtPayload;
    expect(payload.sub).toBe('3');

    // email is looked up and stored lower-cased and trimmed; name is trimmed; password is hashed
    expect(clientQuery.mock.calls[1][1]).toEqual(['asha@example.com']);
    const [, insertParams] = clientQuery.mock.calls[2];
    expect(insertParams[0]).toBe('Asha');
    expect(insertParams[1]).toBe('asha@example.com');
    expect(insertParams[2]).not.toBe('secret123');
    expect(await bcrypt.compare('secret123', insertParams[2])).toBe(true);

    const categoryInserts = clientQuery.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO categories'));
    expect(categoryInserts).toHaveLength(8);
    expect(categoryInserts.map(([, p]) => p[1])).toEqual([
      'Food', 'Transport', 'Rent', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other',
    ]);
    expect(categoryInserts.every(([, p]) => p[0] === 3)).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  it('rolls back and returns 500 when something fails mid-way', async () => {
    clientQuery.mockResolvedValueOnce(result([])); // BEGIN
    clientQuery.mockRejectedValueOnce(new Error('db down')); // email check fails
    clientQuery.mockResolvedValue(result([])); // ROLLBACK
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(500);
    expect(clientQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('returns 401 for an unknown email', async () => {
    query.mockResolvedValueOnce(result([]));
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'secret123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Wrong email or password');
  });

  it('returns 401 for a wrong password', async () => {
    query.mockResolvedValueOnce(result([userRow({ password_hash: await bcrypt.hash('right-pass', 4) })]));
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Wrong email or password');
  });

  it('returns a token and the public user for correct credentials', async () => {
    query.mockResolvedValueOnce(result([userRow({ password_hash: await bcrypt.hash('right-pass', 4), monthly_budget: 20000 })]));
    const res = await request(app).post('/api/auth/login').send({ email: ' ASHA@example.com ', password: 'right-pass' });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 3, email: 'asha@example.com', name: 'Asha', currency: 'INR', monthly_budget: 20000 });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(query.mock.calls[0][1]).toEqual(['asha@example.com']);
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET as string)).toMatchObject({ sub: '3' });
  });

  it('returns 500 when the database fails', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Something went wrong on the server');
  });
});

describe('GET /api/auth/me', () => {
  it('requires a login token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user without the password hash', async () => {
    query.mockResolvedValueOnce(result([userRow({ id: 7 })]));
    const res = await request(app).get('/api/auth/me').set(authHeader(7));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7, email: 'asha@example.com', name: 'Asha', currency: 'INR', monthly_budget: null });
    expect(query.mock.calls[0][1]).toEqual([7]);
  });

  it('returns 404 when the user no longer exists', async () => {
    query.mockResolvedValueOnce(result([]));
    const res = await request(app).get('/api/auth/me').set(authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});
