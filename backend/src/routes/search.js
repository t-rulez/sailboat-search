'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');
const { runRefresh, fetchRates } = require('../jobs/refresh');

// GET /api/search
// Query-params: boatType, brand, yearMin, priceMin, priceMax, sizeMin, sizeMax,
//               sort (price_nok|year|length_ft), dir (asc|desc),
//               status (active|sold|all), source (finn|blocket|dba|all)
router.get('/', async (req, res) => {
  try {
    const {
      boatType = '',
      brand = '',
      yearMin,
      priceMin,
      priceMax,
      sizeMin,
      sizeMax,
      sort = 'price_nok',
      dir = 'asc',
      status = 'active',
      source = 'all',
      favoritesOnly = 'false',
    } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    // Tekstsøk
    if (boatType) {
      conditions.push(`(l.title ILIKE $${idx} OR l.boat_type ILIKE $${idx})`);
      values.push(`%${boatType}%`);
      idx++;
    }
    if (brand) {
      conditions.push(`(l.title ILIKE $${idx} OR l.brand ILIKE $${idx})`);
      values.push(`%${brand}%`);
      idx++;
    }

    // Nummeriske filtre
    if (yearMin) {
      conditions.push(`l.year >= $${idx++}`);
      values.push(parseInt(yearMin));
    }
    if (priceMin) {
      conditions.push(`l.price_nok >= $${idx++}`);
      values.push(parseInt(priceMin));
    }
    if (priceMax) {
      conditions.push(`l.price_nok <= $${idx++}`);
      values.push(parseInt(priceMax));
    }
    if (sizeMin) {
      conditions.push(`l.length_ft >= $${idx++}`);
      values.push(parseFloat(sizeMin));
    }
    if (sizeMax) {
      conditions.push(`l.length_ft <= $${idx++}`);
      values.push(parseFloat(sizeMax));
    }

    // Status
    if (status !== 'all') {
      conditions.push(`l.status = $${idx++}`);
      values.push(status);
    }

    // Kilde
    if (source !== 'all') {
      conditions.push(`l.source = $${idx++}`);
      values.push(source);
    }

    // Kun favoritter
    const favJoin = favoritesOnly === 'true'
      ? 'INNER JOIN favorites f ON f.listing_id = l.id'
      : 'LEFT JOIN favorites f ON f.listing_id = l.id';

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sortering – whitelist for å unngå SQL injection
    const safeSort = ['price_nok', 'year', 'length_ft', 'first_seen_at', 'last_changed_at'].includes(sort)
      ? sort : 'price_nok';
    const safeDir = dir === 'desc' ? 'DESC' : 'ASC';

    const sql = `
      SELECT
        l.*,
        CASE WHEN f.id IS NOT NULL THEN true ELSE false END AS is_favorite,
        (SELECT ph.price_nok FROM price_history ph
         WHERE ph.listing_id = l.id ORDER BY ph.recorded_at ASC LIMIT 1
        ) AS initial_price_nok,
        (SELECT COUNT(*) FROM price_history ph WHERE ph.listing_id = l.id) AS price_change_count
      FROM listings l
      ${favJoin}
      ${where}
      ORDER BY l.${safeSort} ${safeDir} NULLS LAST
      LIMIT 200
    `;

    const result = await db.query(sql, values);
    res.json({ listings: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/search/refresh – kjør refresh manuelt (krever token)
router.post('/refresh', async (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Ugyldig token' });
  }
  // Kjør asynkront – returner med en gang
  res.json({ message: 'Refresh startet' });
  try {
    const rates = await fetchRates();
    await runRefresh(req.body || undefined);
  } catch (e) {
    console.error('Manuell refresh feilet:', e);
  }
});

module.exports = router;
