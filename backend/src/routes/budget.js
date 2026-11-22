const express = require('express');
const { query } = require('../db');

const router = express.Router();

// PUT /api/budget  { monthly_budget: 20000 }  (null clears it)
router.put('/', async (req, res, next) => {
  try {
    let { monthly_budget } = req.body || {};
    if (monthly_budget === '' || monthly_budget === undefined) monthly_budget = null;
    if (monthly_budget !== null && !(Number(monthly_budget) >= 0)) {
      return res.status(400).json({ error: 'Budget must be 0 or more' });
    }
    const { rows } = await query(
      'UPDATE users SET monthly_budget = $1 WHERE id = $2 RETURNING monthly_budget',
      [monthly_budget, req.userId]
    );
    res.json({ monthly_budget: rows[0].monthly_budget });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
