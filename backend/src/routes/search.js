'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');
const https = require('https');

// ─── GET /api/search/rates ───────────────────────────────
const ratesCache = { data: null, ts: 0 };
const CACHE_MS = 60 * 60 * 1000;

router.get('/rates', async (req, res) => {
  if (ratesCache.data && Date.now() - ratesCache.ts < CACHE_MS) {
    return res.json(ratesCache.data);
  }
  try {
    const data = await new Promise((resolve, reject) => {
      https.get('https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK,USD,EUR', (r) => {
        let body = '';
        r.on('data', (c) => body += c);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Ikke JSON: ' + body.substring(0, 80))); }
        });
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
    console.warn('Valuta feilet, bruker fallback:', e.message);
    const fallback = { SEK: 0.98, DKK: 0.148, USD: 10.5, EUR: 11.8 };
    ratesCache.data = fallback;
    ratesCache.ts = Date.now() - (CACHE_MS - 60000);
    res.json(fallback);
  }
});

// ─── POST /api/search/import ─────────────────────────────
// Tar imot søkeresultater fra Finn og lagrer i DB
router.post('/import', async (req, res) => {
  try {
    const { listings } = req.body;
    if (!Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({ error: 'Ingen listings' });
    }

    let inserted = 0, updated = 0, priceChanges = 0;
    const dates = {}; // external_id -> first_seen_at

    for (const listing of listings) {
      const {
        source, external_id, url, title, brand, boat_type,
        price_nok, price_original, currency, year, length_ft,
        image_url, location,
      } = listing;

      if (!source || !external_id) continue;

      const existing = await db.query(
        'SELECT id, price_nok FROM listings WHERE source=$1 AND external_id=$2',
        [source, external_id]
      );

      if (existing.rows.length === 0) {
        const result = await db.query(
          `INSERT INTO listings
             (source, external_id, url, title, brand, boat_type,
              price_nok, price_original, currency, year, length_ft,
              image_url, location, status, is_favorite,
              first_seen_at, last_checked_at, last_changed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',false,NOW(),NOW(),NOW())
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
        dates[`${source}:${external_id}`] = new Date().toISOString();
        inserted++;
      } else {
        const row = existing.rows[0];
        dates[`${source}:${external_id}`] = row.first_seen_at;
        const priceChanged = price_nok && row.price_nok !== price_nok;
        await db.query(
          `UPDATE listings SET
             url=$3, title=$4, brand=$5, boat_type=$6,
             price_nok=$7, price_original=$8, currency=$9,
             year=$10, length_ft=$11, image_url=$12, location=$13,
             status='active', last_checked_at=NOW(),
             last_changed_at=CASE WHEN $7::integer != price_nok THEN NOW() ELSE last_changed_at END
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
    res.json({ ok: true, inserted, updated, priceChanges, dates });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
