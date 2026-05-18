'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/favorites — hent alle favoritter
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*,
         (SELECT ph.price_nok FROM price_history ph
          WHERE ph.listing_id = l.id ORDER BY ph.recorded_at ASC LIMIT 1
         ) AS initial_price_nok
       FROM listings l
       WHERE l.is_favorite = true
       ORDER BY l.last_changed_at DESC`
    );
    res.json({ listings: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/favorites/:source/:external_id — legg til favoritt
router.post('/:source/:external_id', async (req, res) => {
  try {
    const { source, external_id } = req.params;
    const result = await db.query(
      `UPDATE listings SET is_favorite = true, last_changed_at = NOW()
       WHERE source = $1 AND external_id = $2
       RETURNING id`,
      [source, external_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annonse ikke funnet i DB' });
    }
    res.json({ ok: true, source, external_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/favorites/:source/:external_id — fjern favoritt
router.delete('/:source/:external_id', async (req, res) => {
  try {
    const { source, external_id } = req.params;
    await db.query(
      `UPDATE listings SET is_favorite = false, last_changed_at = NOW()
       WHERE source = $1 AND external_id = $2`,
      [source, external_id]
    );
    res.json({ ok: true, source, external_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
