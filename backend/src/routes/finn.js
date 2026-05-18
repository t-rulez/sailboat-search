'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.finn.no/',
        ...extraHeaders,
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseNextData(html) {
  // Finn __NEXT_DATA__ script-tag
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}

function extractDocs(nextData) {
  if (!nextData) return [];
  const pp = nextData?.props?.pageProps;
  // Prøv ulike stier i Next.js datastrukturen
  const candidates = [
    pp?.search?.docs,
    pp?.searchResult?.docs,
    pp?.initialData?.docs,
    pp?.data?.docs,
    pp?.listings,
    pp?.results,
    nextData?.props?.initialProps?.docs,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

// ─── GET /api/finn/debug ─────────────────────────────────
router.get('/debug', async (req, res) => {
  const url = 'https://www.finn.no/mobility/search/boat?q=katamaran&sales_form=120&sales_form=121';
  console.log('Debug: henter', url);

  const { status, body } = await httpsGet(url).catch(e => ({ status: 'ERR', body: e.message }));
  console.log('Debug status:', status, 'body length:', body.length);

  const nextData = parseNextData(body);
  const docs = extractDocs(nextData);

  res.json({
    status,
    bodyLength: body.length,
    hasNextData: !!nextData,
    nextDataKeys: nextData ? Object.keys(nextData?.props?.pageProps || {}).slice(0, 10) : [],
    docsFound: docs.length,
    firstDoc: docs[0] || null,
    htmlSnippet: body.substring(0, 300).replace(/\s+/g, ' '),
  });
});

// ─── GET /api/finn ───────────────────────────────────────
router.get('/', async (req, res) => {
  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;
  const q = ['katamaran', brand].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    q,
    sales_form: '120',
    price_from: priceMin,
    price_to: priceMax,
    year_from: yearMin,
    boat_length_from: sizeMin,
    boat_length_to: sizeMax,
    sort: '1',
    rows: '48',
    page: '1',
  });

  const url = `https://www.finn.no/mobility/search/boat?${params}`;
  console.log('Finn URL:', url);

  try {
    const { status, body } = await httpsGet(url);
    console.log('Finn svar:', status, 'length:', body.length);

    if (status === 403) {
      return res.status(403).json({ error: 'Finn blokkerer IP', docs: [] });
    }

    // Prøv å parse __NEXT_DATA__
    const nextData = parseNextData(body);
    if (nextData) {
      const docs = extractDocs(nextData);
      console.log(`Finn: ${docs.length} annonser fra __NEXT_DATA__`);
      if (docs.length > 0) {
        return res.json({ docs });
      }
      // Logg pageProps-nøkler for debugging
      console.log('pageProps keys:', Object.keys(nextData?.props?.pageProps || {}).join(', '));
    } else {
      console.log('Ingen __NEXT_DATA__ funnet');
      console.log('HTML-start:', body.substring(0, 200).replace(/\s+/g, ' '));
    }

    res.json({ docs: [] });
  } catch (err) {
    console.error('Finn feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
