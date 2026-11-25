import { Router } from 'express';
import { query } from '../db';

const router = Router();

// PUT /api/budget  { monthly_budget: 20000 }  (null clears it)
router.put('/', async (req, res, next) => {
  try {
    const raw = (req.body || {}).monthly_budget as number | string | null | undefined;
    const monthlyBudget = raw === '' || raw === undefined || raw === null ? null : Number(raw);
    if (monthlyBudget !== null && !(monthlyBudget >= 0)) {
      res.status(400).json({ error: 'Budget must be 0 or more' });
      return;
    }
    const { rows } = await query<{ monthly_budget: number | null }>(
      'UPDATE users SET monthly_budget = $1 WHERE id = $2 RETURNING monthly_budget',
      [monthlyBudget, req.userId]
    );
    res.json({ monthly_budget: rows[0].monthly_budget });
  } catch (err) {
    next(err);
  }
});

export default router;
