import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth, signToken } from '../../src/middleware/auth';

const app = express();
app.get('/protected', requireAuth, (req, res) => {
  res.json({ userId: req.userId });
});

describe('signToken', () => {
  it('puts the user id in the subject and expires in 30 days', () => {
    const payload = jwt.verify(signToken(42), process.env.JWT_SECRET as string) as jwt.JwtPayload;
    expect(payload.sub).toBe('42');
    const days = ((payload.exp as number) - (payload.iat as number)) / 86400;
    expect(days).toBe(30);
  });
});

describe('requireAuth', () => {
  it('lets a valid token through and sets req.userId as a number', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${signToken(5)}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 5 });
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not logged in' });
  });

  it('rejects a header that is not a Bearer token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Not logged in');
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session expired/);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ sub: '1' }, 'some-other-secret');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ sub: '1' }, process.env.JWT_SECRET as string, { expiresIn: -10 });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session expired/);
  });
});
