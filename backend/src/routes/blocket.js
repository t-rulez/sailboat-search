'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

// SEK til NOK fallback (oppdateres via /api/search/rates)
const FALLBACK_SEK_TO_NOK = 0.98;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Referer': 'https://www.blocket.se/',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Blocket redirect ->', res.headers.location);
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

function buildUrl({ q, priceMinSEK, priceMaxSEK, yearMin, sizeMin, sizeMax, page = 1 }) {
  const params = new URLSearchParams({ q, class: '2188' });
  if (priceMinSEK) params.set('price_from', priceMinSEK);
  if (priceMaxSEK) params.set('price_to', priceMaxSEK);
  // Blocket støtter ikke year_from i søket
  if (sizeMin)     params.set('length_feet_from', sizeMin);
  if (sizeMax)     params.set('length_feet_to', sizeMax);
  if (page > 1)    params.set('page', page);
  return `https://www.blocket.se/mobility/search/boat?${params}`;
}

function parseSeoStructuredData(html, sekToNok) {
  const match = html.match(/<script id="seoStructuredData" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return [];
  try {
    const json = JSON.parse(match[1]);
    const items = json?.mainEntity?.itemListElement || [];
    return items.map((el, i) => {
      const item = el.item || {};
      const offer = item.offers || {};
      const brandRaw = item.brand?.name || '';
      const brandParts = brandRaw.split(' ');
      const brand = brandParts[0] || null;

      const urlMatch = (item.url || '').match(/\/item\/(\d+)/);
      const id = urlMatch?.[1] || String(i);

      const desc = item.description || item.name || '';
      const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;

      const priceSEK = offer.price ? parseFloat(offer.price) : null;
      const priceNok = priceSEK ? Math.round(priceSEK * sekToNok) : null;

      return {
        source: 'blocket',
        external_id: id,
        url: item.url || `https://www.blocket.se/mobility/item/${id}`,
        title: item.name || desc.substring(0, 80) || 'Ukjent',
        brand,
        boat_type: 'katamaran',
        price_nok: priceNok,
        price_original: priceSEK ? Math.round(priceSEK) : null,
        currency: 'SEK',
        year,
        length_ft: null,
        image_url: item.image || null,
        location: null,
        status: 'active',
      };
    }).filter(d => d.external_id);
  } catch (e) {
    console.error('Blocket parsing feilet:', e.message);
    return [];
  }
}

function parseTotalPages(html) {
  const match = html.match(/pages="(\d+)"/);
  return match ? parseInt(match[1]) : 1;
}

// ─── GET /api/blocket/debug ──────────────────────────────
router.get('/debug', async (req, res) => {
  const url = buildUrl({ q: 'katamaran', page: 1 });
  console.log('Blocket debug URL:', url);
  const { status, body } = await httpsGet(url).catch(e => ({ status: 'ERR', body: e.message }));
  const hasStructuredData = body.includes('seoStructuredData');
  const hasItemList = body.includes('itemListElement');
  const docs = hasStructuredData ? parseSeoStructuredData(body, FALLBACK_SEK_TO_NOK) : [];
  const totalPages = parseTotalPages(body);

  // Snippet rundt seoStructuredData
  let snippet = '';
  if (hasStructuredData) {
    const idx = body.indexOf('seoStructuredData');
    snippet = body.substring(idx, idx + 800);
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

// ─── GET /api/blocket ────────────────────────────────────
router.get('/', async (req, res) => {
  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;
  const q = ['katamaran', brand].filter(Boolean).join(' ');

  // Hent valutakurs fra cache i search-ruten
  const sekToNok = req.app.locals.rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;

  const priceMinSEK = priceMin ? Math.round(parseInt(priceMin) * nokToSek) : '';
  const priceMaxSEK = priceMax ? Math.round(parseInt(priceMax) * nokToSek) : '';

  try {
    const allDocs = [];

    const url1 = buildUrl({ q, priceMinSEK, priceMaxSEK, yearMin, sizeMin, sizeMax, page: 1 });
    console.log('Blocket søkeparametere:', { q, priceMin, priceMax, yearMin, sizeMin, sizeMax });
    console.log('Blocket side 1:', url1);

    const { status, body: body1 } = await httpsGet(url1);
    console.log('Blocket svar:', status, 'length:', body1.length);

    if (status === 403) return res.status(403).json({ error: 'Blocket blokkerer IP', docs: [] });

    const page1Docs = parseSeoStructuredData(body1, sekToNok);
    const totalPages = parseTotalPages(body1);
    allDocs.push(...page1Docs);
    console.log(`Blocket side 1: ${page1Docs.length} annonser, ${totalPages} sider totalt`);

    // Hent resterende sider parallelt
    const maxPages = Math.min(totalPages, 10);
    if (maxPages > 1) {
      const pageNums = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          const url = buildUrl({ q, priceMinSEK, priceMaxSEK, yearMin, sizeMin, sizeMax, page });
          const { body } = await httpsGet(url);
          const docs = parseSeoStructuredData(body, sekToNok);
          console.log(`Blocket side ${page}: ${docs.length} annonser`);
          return docs;
        })
      );
      pageResults.forEach(docs => allDocs.push(...docs));
    }

    console.log(`Blocket totalt: ${allDocs.length} annonser`);
    res.json({ docs: allDocs });
  } catch (err) {
    console.error('Blocket feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
