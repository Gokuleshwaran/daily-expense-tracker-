import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { appFor, authHeader, result, USER_ID } from '../helpers';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db', () => ({ query, pool: {} }));

import router from '../../src/routes/expenses';

const app = appFor('/api/expenses', router);

const expense = (over: Record<string, unknown> = {}) => ({
  id: 11,
  amount: 250,
  date: '2026-11-20',
  note: 'Lunch',
  payment_method: 'UPI',
  category_id: 1,
  category_name: 'Food',
  category_color: '#f97316',
  category_icon: '🍔',
  ...over,
});

const valid = { amount: 250, date: '2026-11-20', category_id: 1, note: 'Lunch', payment_method: 'UPI' };

describe('authentication', () => {
  it.each([
    ['get', '/api/expenses'],
    ['post', '/api/expenses'],
    ['put', '/api/expenses/1'],
    ['delete', '/api/expenses/1'],
    ['get', '/api/expenses/export.csv'],
  ] as const)('%s %s needs a token', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('GET /api/expenses', () => {
  it('always scopes the query to the logged-in user', async () => {
    query.mockResolvedValueOnce(result([expense()]));
    const res = await request(app).get('/api/expenses').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('e.user_id = $1');
    expect(sql).toContain('LIMIT 500');
    expect(params).toEqual([USER_ID]);
  });

  it('adds date, category and note filters as parameters, in order', async () => {
    query.mockResolvedValueOnce(result([]));
    await request(app)
      .get('/api/expenses')
      .query({ from: '2026-11-01', to: '2026-11-30', category_id: '4', q: 'chai' })
      .set(authHeader());
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual([USER_ID, '2026-11-01', '2026-11-30', '4', '%chai%']);
    expect(sql).toContain('e.date >= $2');
    expect(sql).toContain('e.date <= $3');
    expect(sql).toContain('e.category_id = $4');
    expect(sql).toContain('e.note ILIKE $5');
  });

  it('ignores malformed dates instead of passing them to the database', async () => {
    query.mockResolvedValueOnce(result([]));
    await request(app).get('/api/expenses').query({ from: 'yesterday', to: '2026-13' }).set(authHeader());
    expect(query.mock.calls[0][1]).toEqual([USER_ID]);
  });

  it('never puts user input into the SQL text', async () => {
    query.mockResolvedValueOnce(result([]));
    await request(app).get('/api/expenses').query({ q: "'; DROP TABLE expenses; --" }).set(authHeader());
    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toContain('DROP TABLE');
    expect(params[1]).toBe("%'; DROP TABLE expenses; --%");
  });

  it('returns 500 with a generic message when the database fails', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/api/expenses').set(authHeader());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong on the server' });
  });
});

describe('POST /api/expenses', () => {
  it.each([
    [{ ...valid, amount: 0 }, 'Amount must be more than 0'],
    [{ ...valid, amount: -5 }, 'Amount must be more than 0'],
    [{ ...valid, amount: 'abc' }, 'Amount must be more than 0'],
    [{ ...valid, amount: undefined }, 'Amount must be more than 0'],
    [{ ...valid, date: '20/11/2026' }, 'Date must be YYYY-MM-DD'],
    [{ ...valid, date: undefined }, 'Date must be YYYY-MM-DD'],
    [{ ...valid, category_id: undefined }, 'Pick a category'],
    [{ ...valid, payment_method: 'Bitcoin' }, 'Unknown payment method'],
  ])('returns 400 for invalid input %j', async (body, message) => {
    const res = await request(app).post('/api/expenses').set(authHeader()).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(query).not.toHaveBeenCalled();
  });

  it('accepts all four payment methods', async () => {
    for (const method of ['Cash', 'UPI', 'Card', 'Other']) {
      query.mockResolvedValueOnce(result([{ '?column?': 1 }])); // owns category
      query.mockResolvedValueOnce(result([{ id: 1 }])); // insert
      query.mockResolvedValueOnce(result([expense({ payment_method: method })])); // re-select
      const res = await request(app).post('/api/expenses').set(authHeader()).send({ ...valid, payment_method: method });
      expect(res.status).toBe(201);
    }
  });

  it("rejects a category that belongs to someone else", async () => {
    query.mockResolvedValueOnce(result([], 0)); // ownsCategory → false
    const res = await request(app).post('/api/expenses').set(authHeader()).send(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown category');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([1, USER_ID]);
  });

  it('inserts the expense for the logged-in user and returns the full row', async () => {
    query.mockResolvedValueOnce(result([{ '?column?': 1 }]));
    query.mockResolvedValueOnce(result([{ id: 11 }]));
    query.mockResolvedValueOnce(result([expense()]));
    const res = await request(app).post('/api/expenses').set(authHeader()).send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 11, category_name: 'Food' });
    expect(query.mock.calls[1][1]).toEqual([USER_ID, 1, 250, '2026-11-20', 'Lunch', 'UPI']);
  });

  it("defaults the note to '' and the payment method to UPI", async () => {
    query.mockResolvedValueOnce(result([{ '?column?': 1 }]));
    query.mockResolvedValueOnce(result([{ id: 12 }]));
    query.mockResolvedValueOnce(result([expense({ id: 12 })]));
    await request(app).post('/api/expenses').set(authHeader()).send({ amount: 10, date: '2026-11-20', category_id: 1 });
    expect(query.mock.calls[1][1]).toEqual([USER_ID, 1, 10, '2026-11-20', '', 'UPI']);
  });
});

describe('PUT /api/expenses/:id', () => {
  it('validates the body', async () => {
    const res = await request(app).put('/api/expenses/11').set(authHeader()).send({ ...valid, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a category that is not yours', async () => {
    query.mockResolvedValueOnce(result([], 0));
    const res = await request(app).put('/api/expenses/11').set(authHeader()).send(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown category');
  });

  it("returns 404 when the expense isn't yours (update matched no rows)", async () => {
    query.mockResolvedValueOnce(result([{ '?column?': 1 }]));
    query.mockResolvedValueOnce(result([], 0));
    const res = await request(app).put('/api/expenses/999').set(authHeader()).send(valid);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Expense not found');
  });

  it('updates with both the expense id and the user id in the WHERE clause', async () => {
    query.mockResolvedValueOnce(result([{ '?column?': 1 }]));
    query.mockResolvedValueOnce(result([], 1));
    query.mockResolvedValueOnce(result([expense({ amount: 300 })]));
    const res = await request(app).put('/api/expenses/11').set(authHeader()).send({ ...valid, amount: 300 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(300);
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('WHERE id = $6 AND user_id = $7');
    expect(params).toEqual([300, '2026-11-20', 1, 'Lunch', 'UPI', '11', USER_ID]);
  });
});

describe('DELETE /api/expenses/:id', () => {
  it('deletes and returns 204', async () => {
    query.mockResolvedValueOnce(result([], 1));
    const res = await request(app).delete('/api/expenses/11').set(authHeader());
    expect(res.status).toBe(204);
    expect(query.mock.calls[0][0]).toContain('user_id = $2');
    expect(query.mock.calls[0][1]).toEqual(['11', USER_ID]);
  });

  it("returns 404 when nothing was deleted (not found or not yours)", async () => {
    query.mockResolvedValueOnce(result([], 0));
    const res = await request(app).delete('/api/expenses/11').set(authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Expense not found');
  });
});

describe('GET /api/expenses/export.csv', () => {
  it('returns a CSV attachment with a header row', async () => {
    query.mockResolvedValueOnce(result([expense()]));
    const res = await request(app).get('/api/expenses/export.csv').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="expenses_1900-01-01_2999-12-31.csv"');
    expect(res.text.split('\n')).toEqual([
      'Date,Category,Amount,Payment method,Note',
      '"2026-11-20","Food","250","UPI","Lunch"',
    ]);
  });

  it('uses the from/to range in the query and the file name', async () => {
    query.mockResolvedValueOnce(result([]));
    const res = await request(app)
      .get('/api/expenses/export.csv')
      .query({ from: '2026-11-01', to: '2026-11-30' })
      .set(authHeader());
    expect(query.mock.calls[0][1]).toEqual([USER_ID, '2026-11-01', '2026-11-30']);
    expect(res.headers['content-disposition']).toContain('expenses_2026-11-01_2026-11-30.csv');
  });

  it('escapes double quotes and keeps commas inside quoted cells', async () => {
    query.mockResolvedValueOnce(result([expense({ note: 'Said "hi", then left' })]));
    const res = await request(app).get('/api/expenses/export.csv').set(authHeader());
    expect(res.text.split('\n')[1]).toBe('"2026-11-20","Food","250","UPI","Said ""hi"", then left"');
  });

  it('writes empty cells for null category and note', async () => {
    query.mockResolvedValueOnce(result([expense({ category_name: null, note: null })]));
    const res = await request(app).get('/api/expenses/export.csv').set(authHeader());
    expect(res.text.split('\n')[1]).toBe('"2026-11-20","","250","UPI",""');
  });

  it('is not swallowed by the /:id routes', async () => {
    query.mockResolvedValueOnce(result([]));
    const res = await request(app).get('/api/expenses/export.csv').set(authHeader());
    expect(res.status).toBe(200);
  });
});
