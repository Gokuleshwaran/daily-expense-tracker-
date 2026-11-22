const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, color, icon, is_default FROM categories WHERE user_id = $1 ORDER BY is_default DESC, name',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, color = '#6366f1', icon = '💸' } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
    const { rows } = await query(
      'INSERT INTO categories (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING id, name, color, icon, is_default',
      [req.userId, name.trim(), color, icon]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already have a category with this name' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 AND is_default = FALSE',
      [req.params.id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Category not found or is a default category' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
