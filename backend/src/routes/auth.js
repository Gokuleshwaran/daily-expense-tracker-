const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_CATEGORIES = [
  ['Food', '#f97316', '🍔'],
  ['Transport', '#3b82f6', '🚌'],
  ['Rent', '#8b5cf6', '🏠'],
  ['Bills', '#ef4444', '🧾'],
  ['Shopping', '#ec4899', '🛍️'],
  ['Health', '#10b981', '💊'],
  ['Entertainment', '#eab308', '🎬'],
  ['Other', '#64748b', '💸'],
];

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  currency: u.currency,
  monthly_budget: u.monthly_budget,
});

router.post('/signup', async (req, res, next) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    const user = rows[0];
    for (const [cname, color, icon] of DEFAULT_CATEGORIES) {
      await client.query(
        'INSERT INTO categories (user_id, name, color, icon, is_default) VALUES ($1, $2, $3, $4, TRUE)',
        [user.id, cname, color, icon]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
