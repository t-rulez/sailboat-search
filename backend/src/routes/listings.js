'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*,
         CASE WHEN f.id IS NOT NULL THEN true ELSE false END AS is_favorite
       FROM listings l
       LEFT JOIN favorites f ON f.listing_id = l.id
       WHERE l.id = $1`,
      [parseInt(req.params.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ikke funnet' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/:id/price-history
router.get('/:id/price-history', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT price_nok, recorded_at FROM price_history WHERE listing_id=$1 ORDER BY recorded_at ASC',
      [parseInt(req.params.id)]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/listings/:source/:external_id/comment
router.put('/:source/:external_id/comment', async (req, res) => {
  try {
    const { source, external_id } = req.params;
    const { comment } = req.body;
    const result = await db.query(
      `UPDATE listings SET comment = $3, last_changed_at = NOW()
       WHERE source = $1 AND external_id = $2
       RETURNING id, comment`,
      [source, external_id, comment || null]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Annonse ikke funnet' });
    }
    res.json({ ok: true, comment: result.rows[0].comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
