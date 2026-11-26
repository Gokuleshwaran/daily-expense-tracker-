import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { appFor, authHeader, result, USER_ID } from '../helpers';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db', () => ({ query, pool: {} }));

import router from '../../src/routes/dashboard';

const app = appFor('/api/dashboard', router);

interface Mocks {
  total?: number;
  prevTotal?: number;
  count?: number;
  byDay?: { date: string; total: number }[];
  byCategory?: { name: string; color: string; icon: string; total: number }[];
  top?: Record<string, unknown>[];
  budget?: number | null;
  trend?: { month: string; total: number }[];
}

/** Queues the five parallel queries the route runs, plus the trend query for month view */
function mockDb(m: Mocks = {}, month = false) {
  query.mockResolvedValueOnce(result([{ total: m.total ?? 0, prev_total: m.prevTotal ?? 0, count: String(m.count ?? 0) }]));
  query.mockResolvedValueOnce(result(m.byDay ?? []));
  query.mockResolvedValueOnce(result(m.byCategory ?? []));
  query.mockResolvedValueOnce(result(m.top ?? []));
  query.mockResolvedValueOnce(result([{ monthly_budget: m.budget ?? null }]));
  if (month) query.mockResolvedValueOnce(result(m.trend ?? []));
}

const get = (params: Record<string, string>) => request(app).get('/api/dashboard').query(params).set(authHeader());

describe('GET /api/dashboard', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/api/dashboard')).status).toBe(401);
  });

  it('defaults to the week view', async () => {
    mockDb();
    const res = await get({ date: '2026-11-25', today: '2026-11-25', period: 'bogus' });
    expect(res.body.period).toBe('week');
  });

  describe('week view', () => {
    it('runs Monday to Sunday and compares with the previous week', async () => {
      mockDb({ total: 300, prevTotal: 200, count: 4 });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' }); // a Wednesday
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ from: '2026-11-23', to: '2026-11-29', total: 300, prevTotal: 200, count: 4 });
      // totals query: [user, from, to, prevFrom, prevTo]
      expect(query.mock.calls[0][1]).toEqual([USER_ID, '2026-11-23', '2026-11-29', '2026-11-16', '2026-11-22']);
    });

    it('treats Sunday as the last day of the week, not the first', async () => {
      mockDb();
      const res = await get({ period: 'week', date: '2026-11-29', today: '2026-11-29' }); // a Sunday
      expect(res.body.from).toBe('2026-11-23');
      expect(res.body.to).toBe('2026-11-29');
    });

    it('treats Monday as the first day of the week', async () => {
      mockDb();
      const res = await get({ period: 'week', date: '2026-11-23', today: '2026-11-23' });
      expect(res.body.from).toBe('2026-11-23');
    });

    it('returns one zero-filled entry for each of the 7 days', async () => {
      mockDb({ total: 150, byDay: [{ date: '2026-11-24', total: 150 }] });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.byDay).toHaveLength(7);
      expect(res.body.byDay[0]).toEqual({ date: '2026-11-23', total: 0 });
      expect(res.body.byDay[1]).toEqual({ date: '2026-11-24', total: 150 });
      expect(res.body.byDay[6]).toEqual({ date: '2026-11-29', total: 0 });
    });

    it('does not include budget or trend', async () => {
      mockDb({ budget: 5000 });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body).not.toHaveProperty('budget');
      expect(res.body).not.toHaveProperty('trend');
      expect(query).toHaveBeenCalledTimes(5);
    });

    it('spans two months when the week does', async () => {
      mockDb();
      const res = await get({ period: 'week', date: '2026-12-02', today: '2026-12-02' });
      expect(res.body.from).toBe('2026-11-30');
      expect(res.body.to).toBe('2026-12-06');
    });
  });

  describe('daily average', () => {
    it('divides by the days elapsed so far in the current period', async () => {
      mockDb({ total: 300 });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' }); // Mon, Tue, Wed
      expect(res.body.dailyAverage).toBe(100);
    });

    it('divides by the whole period once it is over', async () => {
      mockDb({ total: 700 });
      const res = await get({ period: 'week', date: '2026-11-10', today: '2026-11-25' });
      expect(res.body.dailyAverage).toBe(100); // 700 / 7
    });

    it('is 0 for a period that has not started', async () => {
      mockDb({ total: 0 });
      const res = await get({ period: 'week', date: '2026-12-10', today: '2026-11-25' });
      expect(res.body.dailyAverage).toBe(0);
    });

    it('rounds to 2 decimals', async () => {
      mockDb({ total: 100 });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.dailyAverage).toBe(33.33);
    });
  });

  describe('change vs previous period', () => {
    it.each([
      [300, 200, 50],
      [100, 200, -50],
      [200, 200, 0],
      [100, 300, -66.7],
    ])('total %d vs previous %d gives %d%%', async (total, prevTotal, pct) => {
      mockDb({ total, prevTotal });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.changePct).toBe(pct);
    });

    it('is null when there was no spending in the previous period', async () => {
      mockDb({ total: 300, prevTotal: 0 });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.changePct).toBeNull();
    });
  });

  describe('categories and top expenses', () => {
    it('adds each category share as a rounded percentage', async () => {
      mockDb({
        total: 300,
        byCategory: [
          { name: 'Food', color: '#f97316', icon: '🍔', total: 200 },
          { name: 'Transport', color: '#3b82f6', icon: '🚌', total: 100 },
        ],
      });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.byCategory).toEqual([
        { name: 'Food', color: '#f97316', icon: '🍔', total: 200, pct: 66.7 },
        { name: 'Transport', color: '#3b82f6', icon: '🚌', total: 100, pct: 33.3 },
      ]);
    });

    it('gives a 0% share when nothing was spent', async () => {
      mockDb({ total: 0, byCategory: [{ name: 'Food', color: '#f97316', icon: '🍔', total: 0 }] });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.byCategory[0].pct).toBe(0);
    });

    it('passes the top expenses through unchanged', async () => {
      const top = [{ id: 1, amount: 900, date: '2026-11-24', note: 'Shoes', category_name: 'Shopping', category_icon: '🛍️' }];
      mockDb({ total: 900, top });
      const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      expect(res.body.top).toEqual(top);
    });

    it('scopes every query to the logged-in user', async () => {
      mockDb({}, false);
      await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
      for (const [sql, params] of query.mock.calls) {
        expect(sql).toMatch(/user_id = \$1|id = \$1/);
        expect(params[0]).toBe(USER_ID);
      }
    });
  });

  describe('month view', () => {
    it('covers the whole calendar month and the month before', async () => {
      mockDb({}, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body).toMatchObject({ period: 'month', from: '2026-11-01', to: '2026-11-30' });
      expect(res.body.byDay).toHaveLength(30);
      expect(query.mock.calls[0][1]).toEqual([USER_ID, '2026-11-01', '2026-11-30', '2026-10-01', '2026-10-31']);
    });

    it('handles February in a leap year', async () => {
      mockDb({}, true);
      const res = await get({ period: 'month', date: '2028-02-10', today: '2028-02-10' });
      expect(res.body.to).toBe('2028-02-29');
      expect(res.body.byDay).toHaveLength(29);
    });

    it('compares January with the previous December', async () => {
      mockDb({}, true);
      await get({ period: 'month', date: '2027-01-05', today: '2027-01-05' });
      expect(query.mock.calls[0][1]).toEqual([USER_ID, '2027-01-01', '2027-01-31', '2026-12-01', '2026-12-31']);
    });

    it('reports budget used and left', async () => {
      mockDb({ total: 5000, budget: 20000 }, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body.budget).toEqual({ amount: 20000, spent: 5000, left: 15000, pct: 25 });
    });

    it('reports a negative amount left when over budget', async () => {
      mockDb({ total: 25000, budget: 20000 }, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body.budget).toEqual({ amount: 20000, spent: 25000, left: -5000, pct: 125 });
    });

    it('has a null pct for a budget of 0', async () => {
      mockDb({ total: 100, budget: 0 }, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body.budget).toMatchObject({ amount: 0, left: -100, pct: null });
    });

    it('returns budget null when none is set', async () => {
      mockDb({ total: 100 }, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body.budget).toBeNull();
    });

    it('returns the last 6 months, oldest first, zero-filled', async () => {
      mockDb({ trend: [{ month: '2026-11', total: 500 }, { month: '2026-09', total: 300 }] }, true);
      const res = await get({ period: 'month', date: '2026-11-15', today: '2026-11-25' });
      expect(res.body.trend).toEqual([
        { month: '2026-06', total: 0 },
        { month: '2026-07', total: 0 },
        { month: '2026-08', total: 0 },
        { month: '2026-09', total: 300 },
        { month: '2026-10', total: 0 },
        { month: '2026-11', total: 500 },
      ]);
      // trend query: [user, startOfRange, endOfViewedMonth]
      expect(query.mock.calls[5][1]).toEqual([USER_ID, '2026-06-01', '2026-11-30']);
    });

    it('rolls the 6-month trend back across a year boundary', async () => {
      mockDb({}, true);
      const res = await get({ period: 'month', date: '2027-02-10', today: '2027-02-10' });
      expect(res.body.trend.map((t: { month: string }) => t.month)).toEqual([
        '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
      ]);
    });
  });

  describe('query parameters', () => {
    it('falls back to today when date is missing or malformed', async () => {
      mockDb();
      const res = await get({ period: 'week', date: 'not-a-date', today: '2026-11-25' });
      expect(res.body.from).toBe('2026-11-23');
    });

    it('falls back to the server date when today is malformed', async () => {
      mockDb();
      const res = await get({ period: 'week', date: '2026-11-25', today: '25/11/2026' });
      expect(res.status).toBe(200);
    });
  });

  it('returns 500 with a generic message when a query fails', async () => {
    query.mockRejectedValue(new Error('db down'));
    const res = await get({ period: 'week', date: '2026-11-25', today: '2026-11-25' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong on the server' });
  });
});
