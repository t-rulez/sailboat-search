'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');
const https = require('https');

// ─── GET /api/rates ──────────────────────────────────────
// Proxy for valutakurser – unngår CORS-blokkering i nettleseren
const ratesCache = { data: null, ts: 0 };

router.get('/rates', async (req, res) => {
  const CACHE_MS = 60 * 60 * 1000; // 1 time
  if (ratesCache.data && Date.now() - ratesCache.ts < CACHE_MS) {
    return res.json(ratesCache.data);
  }
  try {
    const data = await new Promise((resolve, reject) => {
      https.get('https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK,USD,EUR', (r) => {
        let body = '';
        r.on('data', (c) => body += c);
        r.on('end', () => resolve(JSON.parse(body)));
      }).on('error', reject);
    });
    const rates = {
      SEK: 1 / data.rates.SEK,
      DKK: 1 / data.rates.DKK,
      USD: 1 / data.rates.USD,
      EUR: 1 / data.rates.EUR,
    };
    ratesCache.data = rates;
    ratesCache.ts = Date.now();
    res.json(rates);
  } catch (e) {
    console.error('Valuta feilet:', e.message);
    // Fallback-kurser
    res.json({ SEK: 0.098, DKK: 0.148, USD: 10.5, EUR: 11.8 });
  }
});

// ─── GET /api/search ─────────────────────────────────────
// Hent lagrede annonser fra DB med filtre
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

    if (boatType) {
      conditions.push(`(l.title ILIKE $${idx} OR l.boat_type ILIKE $${idx})`);
      values.push(`%${boatType}%`); idx++;
    }
    if (brand) {
      conditions.push(`(l.title ILIKE $${idx} OR l.brand ILIKE $${idx})`);
      values.push(`%${brand}%`); idx++;
    }
    if (yearMin)  { conditions.push(`l.year >= $${idx++}`);       values.push(parseInt(yearMin)); }
    if (priceMin) { conditions.push(`l.price_nok >= $${idx++}`);  values.push(parseInt(priceMin)); }
    if (priceMax) { conditions.push(`l.price_nok <= $${idx++}`);  values.push(parseInt(priceMax)); }
    if (sizeMin)  { conditions.push(`l.length_ft >= $${idx++}`);  values.push(parseFloat(sizeMin)); }
    if (sizeMax)  { conditions.push(`l.length_ft <= $${idx++}`);  values.push(parseFloat(sizeMax)); }
    if (status !== 'all') { conditions.push(`l.status = $${idx++}`); values.push(status); }
    if (source !== 'all') { conditions.push(`l.source = $${idx++}`); values.push(source); }

    const favJoin = favoritesOnly === 'true'
      ? 'INNER JOIN favorites f ON f.listing_id = l.id'
      : 'LEFT JOIN favorites f ON f.listing_id = l.id';

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeSort = ['price_nok','year','length_ft','first_seen_at','last_changed_at'].includes(sort) ? sort : 'price_nok';
    const safeDir  = dir === 'desc' ? 'DESC' : 'ASC';

    const sql = `
      SELECT l.*,
        CASE WHEN f.id IS NOT NULL THEN true ELSE false END AS is_favorite,
        (SELECT ph.price_nok FROM price_history ph
         WHERE ph.listing_id = l.id ORDER BY ph.recorded_at ASC LIMIT 1) AS initial_price_nok,
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

// ─── POST /api/search/import ──────────────────────────────
// Tar imot søkeresultater fra klienten og lagrer i DB
router.post('/import', async (req, res) => {
  try {
    const { listings } = req.body;
    if (!Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({ error: 'Ingen listings i body' });
    }

    let inserted = 0, updated = 0, priceChanges = 0;

    for (const listing of listings) {
      const {
        source, external_id, url, title, brand, boat_type,
        price_nok, price_original, currency, year, length_ft,
        image_url, location,
      } = listing;

      if (!source || !external_id) continue;

      // Sjekk om finnes fra før
      const existing = await db.query(
        'SELECT id, price_nok FROM listings WHERE source=$1 AND external_id=$2',
        [source, external_id]
      );

      if (existing.rows.length === 0) {
        // Ny annonse
        const result = await db.query(
          `INSERT INTO listings
             (source, external_id, url, title, brand, boat_type,
              price_nok, price_original, currency, year, length_ft,
              image_url, location, status, first_seen_at, last_checked_at, last_changed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',NOW(),NOW(),NOW())
           RETURNING id`,
          [source, external_id, url, title, brand, boat_type,
           price_nok, price_original, currency, year, length_ft,
           image_url, location]
        );
        if (price_nok) {
          await db.query(
            'INSERT INTO price_history (listing_id, price_nok) VALUES ($1,$2)',
            [result.rows[0].id, price_nok]
          );
        }
        inserted++;
      } else {
        const row = existing.rows[0];
        const priceChanged = price_nok && row.price_nok !== price_nok;

        await db.query(
          `UPDATE listings SET
             url=$3, title=$4, brand=$5, boat_type=$6,
             price_nok=$7, price_original=$8, currency=$9,
             year=$10, length_ft=$11, image_url=$12, location=$13,
             status='active', last_checked_at=NOW(),
             last_changed_at=CASE WHEN $7 != price_nok THEN NOW() ELSE last_changed_at END
           WHERE source=$1 AND external_id=$2`,
          [source, external_id, url, title, brand, boat_type,
           price_nok, price_original, currency, year, length_ft,
           image_url, location]
        );

        if (priceChanged) {
          await db.query(
            'INSERT INTO price_history (listing_id, price_nok) VALUES ($1,$2)',
            [row.id, price_nok]
          );
          priceChanges++;
        }
        updated++;
      }
    }

    console.log(`Import: ${inserted} nye, ${updated} oppdatert, ${priceChanges} prisendringer`);
    res.json({ ok: true, inserted, updated, priceChanges });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
