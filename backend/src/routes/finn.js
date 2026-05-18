'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.finn.no/',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseSeoStructuredData(html) {
  const match = html.match(/<script id="seoStructuredData" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    const items = json?.mainEntity?.itemListElement || [];
    return items.map((el, i) => {
      const item = el.item || {};
      const offer = item.offers || {};
      const brandRaw = item.brand?.name || '';
      // Brand er "Lagoon Seilbåt/Motorseiler" – splitt på første mellomrom for å få merkenavn
      const brandParts = brandRaw.split(' ');
      const boatClass = brandParts.slice(1).join(' ') || brandRaw;
      const brand = brandParts[0] || null;

      const urlMatch = (item.url || '').match(/\/item\/(\d+)/);
      const id = urlMatch?.[1] || String(i);

      const desc = item.description || '';
      const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      const ftMatch = desc.match(/(\d{2})[''´`]/) || desc.match(/(\d{2})\s*fot/i);
      const mMatch = desc.match(/([\d,]+)\s*m\b/i);
      let lengthFt = null;
      if (ftMatch) lengthFt = parseFloat(ftMatch[1]);
      else if (mMatch) lengthFt = parseFloat((parseFloat(mMatch[1].replace(',', '.')) / 0.3048).toFixed(1));

      return {
        source: 'finn',
        external_id: id,
        url: item.url || `https://www.finn.no/mobility/item/${id}`,
        title: item.name || desc.substring(0, 80) || 'Ukjent',
        brand,
        boat_class: boatClass,
        boat_type: 'katamaran',
        price_nok: offer.price ? Math.round(parseFloat(offer.price)) : null,
        price_original: offer.price ? Math.round(parseFloat(offer.price)) : null,
        currency: offer.priceCurrency || 'NOK',
        year,
        length_ft: lengthFt,
        image_url: item.image || null,
        location: null,
        status: 'active',
      };
    }).filter(d => d.external_id);
  } catch (e) {
    console.error('Parsing feilet:', e.message);
    return [];
  }
}

function parseTotalPages(html) {
  const match = html.match(/pages="(\d+)"/);
  return match ? parseInt(match[1]) : 1;
}

function buildUrl({ q, priceMin, priceMax, yearMin, sizeMin, sizeMax, page = 1 }) {
  // URLSearchParams deduplikerer nøkler, så vi bygger URL manuelt for sales_form
  const params = new URLSearchParams({ q, class: '2188' });
  if (priceMin) params.set('price_from', priceMin);
  if (priceMax) params.set('price_to', priceMax);
  if (yearMin)  params.set('year_from', yearMin);
  if (sizeMin)  params.set('length_feet_from', sizeMin);
  if (sizeMax)  params.set('length_feet_to', sizeMax);
  if (page > 1) params.set('page', page);
  // sales_form=120 (brukt) og sales_form=121 (ny) sendes som to separate parametere
  return `https://www.finn.no/mobility/search/boat?${params}&sales_form=120&sales_form=121`;
}

// ─── GET /api/finn/debug ─────────────────────────────────
router.get('/debug', async (req, res) => {
  const url = buildUrl({ q: 'katamaran', page: 1 });
  console.log('Debug URL:', url);
  const { status, body } = await httpsGet(url).catch(e => ({ status: 'ERR', body: e.message }));
  const docs = parseSeoStructuredData(body);
  const totalPages = parseTotalPages(body);
  res.json({ status, url, bodyLength: body.length, totalPages, docsFound: docs.length, docs });
});

// ─── GET /api/finn ───────────────────────────────────────
router.get('/', async (req, res) => {
  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;
  const q = ['katamaran', brand].filter(Boolean).join(' ');

  try {
    const allDocs = [];

    // Hent side 1 og finn antall sider
    const url1 = buildUrl({ q, priceMin, priceMax, yearMin, sizeMin, sizeMax, page: 1 });
    console.log('Finn søkeparametere:', { q, priceMin, priceMax, yearMin, sizeMin, sizeMax });
    console.log('Finn side 1:', url1);
    const { status, body: body1 } = await httpsGet(url1);

    if (status === 403) return res.status(403).json({ error: 'Finn blokkerer IP', docs: [] });

    const page1Docs = parseSeoStructuredData(body1);
    const totalPages = parseTotalPages(body1);
    allDocs.push(...page1Docs);
    console.log(`Finn side 1: ${page1Docs.length} annonser, ${totalPages} sider totalt`);

    // Hent resterende sider parallelt (maks 10 sider = ~100 resultater)
    const maxPages = Math.min(totalPages, 10);
    if (maxPages > 1) {
      const pageNums = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          const url = buildUrl({ q, priceMin, priceMax, yearMin, sizeMin, sizeMax, page });
          const { body } = await httpsGet(url);
          const docs = parseSeoStructuredData(body);
          console.log(`Finn side ${page}: ${docs.length} annonser`);
          return docs;
        })
      );
      pageResults.forEach(docs => allDocs.push(...docs));
    }

    // Filtrer på størrelse hvis oppgitt
    const filtered = allDocs.filter(d => {
      if (sizeMin && d.length_ft && d.length_ft < parseFloat(sizeMin)) return false;
      if (sizeMax && d.length_ft && d.length_ft > parseFloat(sizeMax)) return false;
      return true;
    });

    console.log(`Finn totalt: ${allDocs.length} annonser, ${filtered.length} etter størrelsefilter`);
    res.json({ docs: filtered });
  } catch (err) {
    console.error('Finn feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
