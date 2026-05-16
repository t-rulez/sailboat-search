'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/favorites – hent alle favoritter
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, true AS is_favorite,
         (SELECT ph.price_nok FROM price_history ph
          WHERE ph.listing_id = l.id ORDER BY ph.recorded_at ASC LIMIT 1
         ) AS initial_price_nok,
         (SELECT COUNT(*) FROM price_history ph WHERE ph.listing_id = l.id) AS price_change_count
       FROM listings l
       INNER JOIN favorites f ON f.listing_id = l.id
       ORDER BY f.created_at DESC`
    );
    res.json({ listings: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/favorites/:id – legg til favoritt
router.post('/:id', async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    await db.query(
      'INSERT INTO favorites (listing_id) VALUES ($1) ON CONFLICT (listing_id) DO NOTHING',
      [listingId]
    );
    res.json({ ok: true, listing_id: listingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/favorites/:id – fjern favoritt
router.delete('/:id', async (req, res) => {
  try {
    const listingId = parseInt(req.params.id);
    await db.query('DELETE FROM favorites WHERE listing_id=$1', [listingId]);
    res.json({ ok: true, listing_id: listingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
