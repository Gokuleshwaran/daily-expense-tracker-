const express = require('express');
const { query } = require('../db');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- date helpers (all in UTC so server time zone never shifts a day) ----
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const daysBetween = (a, b) => Math.round((b - a) / 86400000) + 1; // inclusive

function rangeFor(period, dateStr) {
  const d = toDate(dateStr);
  if (period === 'week') {
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
    const from = addDays(d, -dow);
    const to = addDays(from, 6);
    return { from, to, prevFrom: addDays(from, -7), prevTo: addDays(from, -1) };
  }
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const prevFrom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const prevTo = addDays(from, -1);
  return { from, to, prevFrom, prevTo };
}

// GET /api/dashboard?period=week|month&date=YYYY-MM-DD&today=YYYY-MM-DD
//   date  = any day inside the period to show (default: today)
//   today = the user's local date, used for "daily average so far"
router.get('/', async (req, res, next) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const today = DATE_RE.test(req.query.today || '') ? req.query.today : fmt(new Date());
    const date = DATE_RE.test(req.query.date || '') ? req.query.date : today;
    const { from, to, prevFrom, prevTo } = rangeFor(period, date);
    const uid = req.userId;
    const F = fmt(from), T = fmt(to);

    const [totals, byDayRes, byCatRes, topRes, userRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE date BETWEEN $2 AND $3), 0) AS total,
           COALESCE(SUM(amount) FILTER (WHERE date BETWEEN $4 AND $5), 0) AS prev_total,
           COUNT(*) FILTER (WHERE date BETWEEN $2 AND $3) AS count
         FROM expenses WHERE user_id = $1 AND date BETWEEN $4 AND $3`,
        [uid, F, T, fmt(prevFrom), fmt(prevTo)]
      ),
      query(
        `SELECT date, SUM(amount) AS total FROM expenses
         WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY date`,
        [uid, F, T]
      ),
      query(
        `SELECT COALESCE(c.name, 'Uncategorised') AS name, COALESCE(c.color, '#94a3b8') AS color,
                COALESCE(c.icon, '💸') AS icon, SUM(e.amount) AS total
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
         WHERE e.user_id = $1 AND e.date BETWEEN $2 AND $3
         GROUP BY 1, 2, 3 ORDER BY total DESC`,
        [uid, F, T]
      ),
      query(
        `SELECT e.id, e.amount, e.date, e.note, c.name AS category_name, c.icon AS category_icon
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
         WHERE e.user_id = $1 AND e.date BETWEEN $2 AND $3
         ORDER BY e.amount DESC, e.date DESC LIMIT 5`,
        [uid, F, T]
      ),
      query('SELECT monthly_budget FROM users WHERE id = $1', [uid]),
    ]);

    const total = Number(totals.rows[0].total);
    const prevTotal = Number(totals.rows[0].prev_total);

    // One entry per day of the period, zero-filled
    const dayMap = Object.fromEntries(byDayRes.rows.map((r) => [r.date, Number(r.total)]));
    const byDay = [];
    for (let d = from; d <= to; d = addDays(d, 1)) byDay.push({ date: fmt(d), total: dayMap[fmt(d)] || 0 });

    // Days counted for the average: up to today if the period is current, else the whole period
    const todayD = toDate(today);
    const endForAvg = todayD < from ? null : todayD < to ? todayD : to;
    const daysElapsed = endForAvg ? daysBetween(from, endForAvg) : 0;

    const result = {
      period,
      from: F,
      to: T,
      total,
      prevTotal,
      changePct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null,
      count: Number(totals.rows[0].count),
      dailyAverage: daysElapsed ? Math.round((total / daysElapsed) * 100) / 100 : 0,
      byDay,
      byCategory: byCatRes.rows.map((r) => ({
        ...r,
        total: Number(r.total),
        pct: total ? Math.round((Number(r.total) / total) * 1000) / 10 : 0,
      })),
      top: topRes.rows,
    };

    if (period === 'month') {
      const budget = userRes.rows[0]?.monthly_budget ?? null;
      result.budget = budget === null ? null : { amount: budget, spent: total, left: budget - total, pct: budget ? Math.round((total / budget) * 1000) / 10 : null };

      // Last 6 months, zero-filled
      const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 5, 1));
      const trendRes = await query(
        `SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS total FROM expenses
         WHERE user_id = $1 AND date BETWEEN $2 AND $3 GROUP BY 1`,
        [uid, fmt(start), T]
      );
      const tMap = Object.fromEntries(trendRes.rows.map((r) => [r.month, Number(r.total)]));
      result.trend = [];
      for (let i = 0; i < 6; i++) {
        const m = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
        const key = fmt(m).slice(0, 7);
        result.trend.push({ month: key, total: tMap[key] || 0 });
      }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
