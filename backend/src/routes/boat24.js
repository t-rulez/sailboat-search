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
        'Accept-Language': 'no-NO,no;q=0.9,en;q=0.8',
        'Referer': 'https://www.boat24.com/',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Boat24 redirect ->', res.headers.location);
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

function buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  // Priser er allerede i NOK siden whr=NOK
  // Lengde konverteres fra fot til meter
  const params = new URLSearchParams();
  if (brand)    params.set('src', brand);
  params.set('cat', '1');
  params.append('typ[]', '231');  // Katamaran
  params.set('whr', 'NOK');       // Valuta NOK
  if (priceMin) params.set('prs_min', priceMin);
  if (priceMax) params.set('prs_max', priceMax);
  if (sizeMin)  params.set('lge_min', Math.round(parseInt(sizeMin) * 0.3048));
  if (sizeMax)  params.set('lge_max', Math.round(parseInt(sizeMax) * 0.3048));
  if (yearMin)  params.set('jhr_min', yearMin);
  // Region: Norge=43, Sverige=49, Danmark=15
  params.append('rgo[]', '43');
  params.append('rgo[]', '49');
  params.append('rgo[]', '15');
  params.set('slt', '0');
  return `https://www.boat24.com/no/seilbater/?${params}`;
}

function parseSeoStructuredData(html) {
  const match = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  if (!match) return [];

  const results = [];
  for (const tag of match) {
    const jsonStr = tag.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
    try {
      const json = JSON.parse(jsonStr);
      // Boat24 kan bruke ItemList eller Product direkte
      const items = json?.itemListElement || (json['@type'] === 'Product' ? [{ item: json }] : []);
      for (const el of items) {
        const item = el.item || el;
        if (item['@type'] !== 'Product') continue;

        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers || {};
        const urlMatch = (item.url || '').match(/\/(\d+)\/?$/);
        const id = urlMatch?.[1] || '';
        if (!id) continue;

        const brandRaw = item.brand?.name || '';
        const desc = item.description || item.name || '';
        const yearMatch = desc.match(/\b(19|20)\d{2}\b/);

        results.push({
          source: 'boat24',
          external_id: id,
          url: item.url || `https://www.boat24.com/no/seilbater/${id}/`,
          title: item.name || desc.substring(0, 80) || 'Ukjent',
          brand: brandRaw || null,
          boat_type: 'katamaran',
          price_nok: offer.price ? Math.round(parseFloat(offer.price)) : null,
          price_original: offer.price ? Math.round(parseFloat(offer.price)) : null,
          currency: 'NOK',
          year: yearMatch ? parseInt(yearMatch[0]) : null,
          length_ft: null,
          image_url: Array.isArray(item.image) ? item.image[0] : item.image || null,
          location: null,
          status: 'active',
        });
      }
    } catch (e) { /* ikke JSON */ }
  }
  return results;
}

function parseTotalPages(html) {
  const match = html.match(/pages="(\d+)"/);
  return match ? parseInt(match[1]) : 1;
}

// ─── GET /api/boat24/debug ───────────────────────────────
router.get('/debug', async (req, res) => {
  const url = buildUrl({ brand: '', yearMin: '', priceMin: '', priceMax: '', sizeMin: '', sizeMax: '' });
  console.log('Boat24 debug URL:', url);
  const { status, body } = await httpsGet(url).catch(e => ({ status: 'ERR', body: e.message }));

  const hasStructuredData = body.includes('application/ld+json');
  const hasItemList = body.includes('itemListElement');
  const docs = parseSeoStructuredData(body);
  const totalPages = parseTotalPages(body);

  let snippet = '';
  if (hasStructuredData) {
    const idx = body.indexOf('application/ld+json');
    snippet = body.substring(idx - 10, idx + 600);
  } else {
    snippet = body.substring(0, 400);
  }

  res.json({
    url,
    status,
    bodyLength: body.length,
    hasStructuredData,
    hasItemList,
    totalPages,
    docsFound: docs.length,
    firstDoc: docs[0] || null,
    snippet,
  });
});

// ─── GET /api/boat24 ────────────────────────────────────
router.get('/', async (req, res) => {
  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;

  try {
    const allDocs = [];

    const url1 = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax });
    console.log('Boat24 søkeparametere:', { brand, yearMin, priceMin, priceMax, sizeMin, sizeMax });
    console.log('Boat24 side 1:', url1);

    const { status, body: body1 } = await httpsGet(url1);
    console.log('Boat24 svar:', status, 'length:', body1.length);

    if (status === 403) return res.status(403).json({ error: 'Boat24 blokkerer IP', docs: [] });

    const page1Docs = parseSeoStructuredData(body1);
    const totalPages = parseTotalPages(body1);
    allDocs.push(...page1Docs);
    console.log(`Boat24 side 1: ${page1Docs.length} annonser, ${totalPages} sider totalt`);

    // Hent resterende sider parallelt
    const maxPages = Math.min(totalPages, 10);
    if (maxPages > 1) {
      const pageNums = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          const url = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax });
          const fullUrl = `${url}&pg=${page}`;
          const { body } = await httpsGet(fullUrl);
          const docs = parseSeoStructuredData(body);
          console.log(`Boat24 side ${page}: ${docs.length} annonser`);
          return docs;
        })
      );
      pageResults.forEach(docs => allDocs.push(...docs));
    }

    console.log(`Boat24 totalt: ${allDocs.length} annonser`);
    res.json({ docs: allDocs });
  } catch (err) {
    console.error('Boat24 feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
