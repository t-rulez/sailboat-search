'use strict';
const db = require('../db');
const finn = require('../scrapers/finn');
const blocket = require('../scrapers/blocket');
const dba = require('../scrapers/dba');

// Hent live valutakurser
async function fetchRates() {
  try {
    const axios = require('axios');
    const res = await axios.get('https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK', {
      timeout: 8000,
    });
    return {
      SEK: 1 / res.data.rates.SEK,
      DKK: 1 / res.data.rates.DKK,
    };
  } catch (e) {
    console.warn('Valuta-API feilet, bruker fallback:', e.message);
    return { SEK: 0.098, DKK: 0.148 };
  }
}

// Lagrer eller oppdaterer én annonserad i databasen
async function upsertListing(listing) {
  const {
    source, external_id, url, title, brand, boat_type,
    price_nok, price_original, currency, year, length_ft,
    image_url, location,
  } = listing;

  // Sjekk om den finnes fra før
  const existing = await db.query(
    'SELECT id, price_nok, status FROM listings WHERE source=$1 AND external_id=$2',
    [source, external_id]
  );

  if (existing.rows.length === 0) {
    // Ny annonse – INSERT
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
    const newId = result.rows[0].id;

    // Logg startpris i prishistorikk
    if (price_nok) {
      await db.query(
        'INSERT INTO price_history (listing_id, price_nok) VALUES ($1, $2)',
        [newId, price_nok]
      );
    }
    return { action: 'inserted', id: newId };
  }

  const row = existing.rows[0];
  const priceChanged = price_nok && row.price_nok !== price_nok;
  const wasInactive = row.status !== 'active';

  // UPDATE – alltid oppdater last_checked_at, og det som har endret seg
  await db.query(
    `UPDATE listings SET
       url=$3, title=$4, brand=$5, boat_type=$6,
       price_nok=$7, price_original=$8, currency=$9,
       year=$10, length_ft=$11, image_url=$12, location=$13,
       status='active',
       last_checked_at=NOW(),
       last_changed_at=CASE WHEN ($7 != price_nok OR status != 'active') THEN NOW() ELSE last_changed_at END
     WHERE source=$1 AND external_id=$2`,
    [source, external_id, url, title, brand, boat_type,
     price_nok, price_original, currency, year, length_ft,
     image_url, location]
  );

  // Logg prisendring
  if (priceChanged) {
    await db.query(
      'INSERT INTO price_history (listing_id, price_nok) VALUES ($1, $2)',
      [row.id, price_nok]
    );
  }

  return { action: 'updated', id: row.id, priceChanged, wasInactive };
}

// Sjekker status (solgt/fjernet) for aktive annonser som ikke ble funnet i siste søk
async function checkStaleListings(source, foundExternalIds) {
  if (foundExternalIds.length === 0) return;

  // Hent aktive annonser fra denne kilden som IKKE ble funnet i søket
  const placeholders = foundExternalIds.map((_, i) => `$${i + 2}`).join(',');
  const stale = await db.query(
    `SELECT id, url, external_id FROM listings
     WHERE source=$1 AND status='active'
     AND external_id NOT IN (${placeholders})
     AND last_checked_at < NOW() - INTERVAL '1 hour'`,
    [source, ...foundExternalIds]
  );

  const scraper = source === 'finn' ? finn : source === 'blocket' ? blocket : dba;

  for (const row of stale.rows) {
    const newStatus = await scraper.checkListing(row);
    if (newStatus && newStatus !== 'active') {
      await db.query(
        `UPDATE listings SET status=$1, last_checked_at=NOW(), last_changed_at=NOW()
         WHERE id=$2`,
        [newStatus, row.id]
      );
      console.log(`  ${source} ${row.external_id}: ${newStatus}`);
    } else if (newStatus === 'active') {
      await db.query(
        'UPDATE listings SET last_checked_at=NOW() WHERE id=$1',
        [row.id]
      );
    }
    // Pause mellom kall for å ikke bli blokkert
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Kjøres for ett søk (brukerparametre lagres ikke – vi bruker standardsøket)
async function runSearchForSource(source, scraper, params, rates) {
  const run = await db.query(
    'INSERT INTO search_runs (source, started_at) VALUES ($1, NOW()) RETURNING id',
    [source]
  );
  const runId = run.rows[0].id;

  try {
    const listings = await scraper.search(params, rates);
    console.log(`${source}: ${listings.length} annonser funnet`);

    let inserted = 0, updated = 0;
    for (const listing of listings) {
      const res = await upsertListing(listing);
      if (res.action === 'inserted') inserted++;
      else updated++;
    }

    // Sjekk stale annonser
    const foundIds = listings.map((l) => l.external_id);
    await checkStaleListings(source, foundIds);

    await db.query(
      'UPDATE search_runs SET finished_at=NOW(), listings_found=$1 WHERE id=$2',
      [listings.length, runId]
    );

    return { source, found: listings.length, inserted, updated };
  } catch (err) {
    console.error(`${source} refresh feilet:`, err.message);
    await db.query(
      'UPDATE search_runs SET finished_at=NOW(), error=$1 WHERE id=$2',
      [err.message, runId]
    );
    return { source, found: 0, error: err.message };
  }
}

// Standard søkeparametre for bakgrunns-refresh
// Bakgrunnssøket er alltid begrenset til katamaraner
const DEFAULT_PARAMS = {
  boatType: 'katamaran',
  brand: '',
  yearMin: 2018,
  priceMin: 1000000,
  priceMax: 10000000,
  sizeMin: 30,
  sizeMax: 60,
};

async function runRefresh(customParams) {
  // boatType er alltid 'katamaran' – overskriv eventuell customParam
  const params = { ...DEFAULT_PARAMS, ...customParams, boatType: 'katamaran' };
  console.log(`\n[${new Date().toISOString()}] Starter refresh...`);

  const rates = await fetchRates();
  console.log(`Valutakurser: 1 SEK = ${rates.SEK.toFixed(4)} NOK, 1 DKK = ${rates.DKK.toFixed(4)} NOK`);

  const results = await Promise.allSettled([
    runSearchForSource('finn', finn, params, rates),
    runSearchForSource('blocket', blocket, params, rates),
    runSearchForSource('dba', dba, params, rates),
  ]);

  results.forEach((r) => {
    if (r.status === 'fulfilled') console.log(`  ✓ ${r.value.source}: ${r.value.found} annonser`);
    else console.error(`  ✗ feilet:`, r.reason);
  });

  console.log(`Refresh ferdig.`);
  return results.map((r) => r.value || r.reason);
}

module.exports = { runRefresh, fetchRates, upsertListing };
