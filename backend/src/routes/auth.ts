import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db';
import { requireAuth, signToken } from '../middleware/auth';
import type { PublicUser, UserRow } from '../types/models';

const router = Router();

const DEFAULT_CATEGORIES: [name: string, color: string, icon: string][] = [
  ['Food', '#f97316', '🍔'],
  ['Transport', '#3b82f6', '🚌'],
  ['Rent', '#8b5cf6', '🏠'],
  ['Bills', '#ef4444', '🧾'],
  ['Shopping', '#ec4899', '🛍️'],
  ['Health', '#10b981', '💊'],
  ['Entertainment', '#eab308', '🎬'],
  ['Other', '#64748b', '💸'],
];

const publicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  currency: u.currency,
  monthly_budget: u.monthly_budget,
});

interface SignupBody {
  name?: string;
  email?: string;
  password?: string;
}

router.post('/signup', async (req, res, next) => {
  const { name, email, password } = (req.body || {}) as SignupBody;
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (exists.rowCount) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query<UserRow>(
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
    const { email, password } = (req.body || {}) as SignupBody;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Wrong email or password' });
      return;
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(publicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
