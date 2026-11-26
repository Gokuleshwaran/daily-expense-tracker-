import { Router } from 'express';
import { query } from '../db';
import type { Category } from '../types/models';

const router = Router();

const COLUMNS = 'id, name, color, icon, is_default';

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query<Category>(
      `SELECT ${COLUMNS} FROM categories WHERE user_id = $1 ORDER BY is_default DESC, name`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, color = '#6366f1', icon = '💸' } = (req.body || {}) as Partial<Category>;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    const { rows } = await query<Category>(
      `INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [req.userId, name.trim(), color, icon]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'You already have a category with this name' });
      return;
    }
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 AND is_default = FALSE',
      [req.params.id, req.userId]
    );
    if (!rowCount) {
      res.status(404).json({ error: 'Category not found or is a default category' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
