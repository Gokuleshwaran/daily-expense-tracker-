const express = require('express');
const { query } = require('../db');

const router = express.Router();

const METHODS = ['Cash', 'UPI', 'Card', 'Other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SELECT = `
  SELECT e.id, e.amount, e.date, e.note, e.payment_method, e.category_id,
         c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM expenses e
  LEFT JOIN categories c ON c.id = e.category_id`;

function validate(body) {
  const { amount, date, category_id, payment_method } = body || {};
  if (!(Number(amount) > 0)) return 'Amount must be more than 0';
  if (!date || !DATE_RE.test(date)) return 'Date must be YYYY-MM-DD';
  if (!category_id) return 'Pick a category';
  if (payment_method && !METHODS.includes(payment_method)) return 'Unknown payment method';
  return null;
}

async function ownsCategory(userId, categoryId) {
  const { rowCount } = await query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  return rowCount > 0;
}

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category_id=1&q=text
router.get('/', async (req, res, next) => {
  try {
    const { from, to, category_id, q } = req.query;
    const where = ['e.user_id = $1'];
    const params = [req.userId];
    if (from && DATE_RE.test(from)) { params.push(from); where.push(`e.date >= $${params.length}`); }
    if (to && DATE_RE.test(to)) { params.push(to); where.push(`e.date <= $${params.length}`); }
    if (category_id) { params.push(category_id); where.push(`e.category_id = $${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`e.note ILIKE $${params.length}`); }
    const { rows } = await query(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.date DESC, e.id DESC LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    const { amount, date, category_id, note = '', payment_method = 'UPI' } = req.body;
    if (!(await ownsCategory(req.userId, category_id))) return res.status(400).json({ error: 'Unknown category' });
    const { rows } = await query(
      `INSERT INTO expenses (user_id, category_id, amount, date, note, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.userId, category_id, amount, date, note, payment_method]
    );
    const full = await query(`${SELECT} WHERE e.id = $1`, [rows[0].id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    const { amount, date, category_id, note = '', payment_method = 'UPI' } = req.body;
    if (!(await ownsCategory(req.userId, category_id))) return res.status(400).json({ error: 'Unknown category' });
    const { rowCount } = await query(
      `UPDATE expenses SET amount = $1, date = $2, category_id = $3, note = $4, payment_method = $5
       WHERE id = $6 AND user_id = $7`,
      [amount, date, category_id, note, payment_method, req.params.id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
    const full = await query(`${SELECT} WHERE e.id = $1`, [req.params.id]);
    res.json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rowCount) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/export.csv?from=&to=
router.get('/export.csv', async (req, res, next) => {
  try {
    const { from = '1900-01-01', to = '2999-12-31' } = req.query;
    const { rows } = await query(
      `${SELECT} WHERE e.user_id = $1 AND e.date BETWEEN $2 AND $3 ORDER BY e.date`,
      [req.userId, from, to]
    );
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Date,Category,Amount,Payment method,Note']
      .concat(rows.map((r) => [r.date, r.category_name, r.amount, r.payment_method, r.note].map(esc).join(',')))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${from}_${to}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
