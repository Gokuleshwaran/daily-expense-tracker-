import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { appFor, authHeader, result, USER_ID } from '../helpers';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db', () => ({ query, pool: {} }));

import router from '../../src/routes/categories';

const app = appFor('/api/categories', router);

const cat = { id: 1, name: 'Food', color: '#f97316', icon: '🍔', is_default: true };

describe('GET /api/categories', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/api/categories')).status).toBe(401);
  });

  it("lists only the logged-in user's categories, defaults first", async () => {
    query.mockResolvedValueOnce(result([cat]));
    const res = await request(app).get('/api/categories').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([cat]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE user_id = $1');
    expect(sql).toContain('ORDER BY is_default DESC, name');
    expect(params).toEqual([USER_ID]);
  });
});

describe('POST /api/categories', () => {
  it.each([{}, { name: '' }, { name: '   ' }])('returns 400 for a missing or blank name (%j)', async (body) => {
    const res = await request(app).post('/api/categories').set(authHeader()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Category name is required');
    expect(query).not.toHaveBeenCalled();
  });

  it('creates a category with the default colour and icon when none are given', async () => {
    query.mockResolvedValueOnce(result([{ ...cat, id: 9, name: 'Groceries', is_default: false }]));
    const res = await request(app).post('/api/categories').set(authHeader()).send({ name: '  Groceries ' });
    expect(res.status).toBe(201);
    expect(query.mock.calls[0][1]).toEqual([USER_ID, 'Groceries', '#6366f1', '💸']);
  });

  it('uses the colour and icon that were sent', async () => {
    query.mockResolvedValueOnce(result([{ ...cat, id: 9, is_default: false }]));
    await request(app).post('/api/categories').set(authHeader()).send({ name: 'Pets', color: '#14b8a6', icon: '🐶' });
    expect(query.mock.calls[0][1]).toEqual([USER_ID, 'Pets', '#14b8a6', '🐶']);
  });

  it('returns 409 for a duplicate name (unique violation)', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const res = await request(app).post('/api/categories').set(authHeader()).send({ name: 'Food' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You already have a category with this name');
  });

  it('returns 500 for any other database error', async () => {
    query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).post('/api/categories').set(authHeader()).send({ name: 'Food' });
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a custom category and returns 204', async () => {
    query.mockResolvedValueOnce(result([], 1));
    const res = await request(app).delete('/api/categories/9').set(authHeader());
    expect(res.status).toBe(204);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('user_id = $2');
    expect(sql).toContain('is_default = FALSE');
    expect(params).toEqual(['9', USER_ID]);
  });

  it("returns 404 for a default category, someone else's category or a missing one", async () => {
    query.mockResolvedValueOnce(result([], 0));
    const res = await request(app).delete('/api/categories/1').set(authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Category not found or is a default category');
  });
});
