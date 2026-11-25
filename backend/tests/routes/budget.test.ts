import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { appFor, authHeader, result, USER_ID } from '../helpers';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db', () => ({ query, pool: {} }));

import router from '../../src/routes/budget';

const app = appFor('/api/budget', router);

describe('PUT /api/budget', () => {
  it('requires a token', async () => {
    expect((await request(app).put('/api/budget').send({ monthly_budget: 1 })).status).toBe(401);
  });

  it('saves a budget for the logged-in user', async () => {
    query.mockResolvedValueOnce(result([{ monthly_budget: 20000 }]));
    const res = await request(app).put('/api/budget').set(authHeader()).send({ monthly_budget: 20000 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ monthly_budget: 20000 });
    expect(query.mock.calls[0][1]).toEqual([20000, USER_ID]);
  });

  it('converts a numeric string to a number', async () => {
    query.mockResolvedValueOnce(result([{ monthly_budget: 1500.5 }]));
    await request(app).put('/api/budget').set(authHeader()).send({ monthly_budget: '1500.5' });
    expect(query.mock.calls[0][1]).toEqual([1500.5, USER_ID]);
  });

  it('accepts 0', async () => {
    query.mockResolvedValueOnce(result([{ monthly_budget: 0 }]));
    const res = await request(app).put('/api/budget').set(authHeader()).send({ monthly_budget: 0 });
    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual([0, USER_ID]);
  });

  it.each([[null], [''], [undefined]])('clears the budget when the value is %j', async (value) => {
    query.mockResolvedValueOnce(result([{ monthly_budget: null }]));
    const res = await request(app).put('/api/budget').set(authHeader()).send({ monthly_budget: value });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ monthly_budget: null });
    expect(query.mock.calls[0][1]).toEqual([null, USER_ID]);
  });

  it.each([[-1], ['abc']])('rejects %j with 400', async (value) => {
    const res = await request(app).put('/api/budget').set(authHeader()).send({ monthly_budget: value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Budget must be 0 or more');
    expect(query).not.toHaveBeenCalled();
  });
});
