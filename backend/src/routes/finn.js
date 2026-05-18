'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.finn.no/',
        ...extraHeaders,
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Redirect ->', res.headers.location);
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── GET /api/finn/debug ─────────────────────────────────
// Tester alle kjente URL-varianter og returnerer hva Finn svarer
router.get('/debug', async (req, res) => {
  const results = [];
  const candidates = [
    'https://www.finn.no/api/search-qf?searchkey=BOAT_USED&q=katamaran&rows=2',
    'https://www.finn.no/api/search-qf?searchkey=BOAT&q=katamaran&rows=2',
    'https://www.finn.no/api/search-qf?searchkey=BOAT_FORSALE&q=katamaran&rows=2',
    'https://www.finn.no/api/search?searchkey=BOAT_USED&q=katamaran&rows=2',
    'https://www.finn.no/boat/used/search?q=katamaran&rows=2',
    'https://www.finn.no/api/v1/search-qf?searchkey=BOAT_USED&q=katamaran&rows=2',
    'https://www.finn.no/api/search-qf?searchkey=BOAT_USED&vertical=boat&q=katamaran&rows=2',
    'https://www.finn.no/api/search-qf?searchkey=MOTOR_BOAT_USED&q=katamaran&rows=2',
    'https://www.finn.no/bap/forsale/search?searchkey=BOAT_USED&q=katamaran&rows=2',
  ];

  for (const url of candidates) {
    try {
      const { status, body } = await httpsGet(url);
      const preview = body.substring(0, 150).replace(/\s+/g, ' ');
      results.push({ url: url.substring(30), status, preview });
      console.log('DEBUG', status, url.substring(30, 80));
    } catch (e) {
      results.push({ url: url.substring(30), status: 'ERR', preview: e.message });
    }
  }
  res.json(results);
});

// ─── GET /api/finn ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;
    const q = ['katamaran', brand].filter(Boolean).join(' ');

    const qs = new URLSearchParams({
      q,
      price_from: priceMin, price_to: priceMax,
      year_from: yearMin,
      boat_length_from: sizeMin, boat_length_to: sizeMax,
      sort: '1', rows: '48', page: '1',
    }).toString();

    const candidates = [
      `https://www.finn.no/api/search-qf?searchkey=BOAT_USED&${qs}`,
      `https://www.finn.no/api/search-qf?searchkey=BOAT&${qs}`,
      `https://www.finn.no/api/search-qf?searchkey=BOAT_FORSALE&${qs}`,
      `https://www.finn.no/api/search?searchkey=BOAT_USED&${qs}`,
      `https://www.finn.no/boat/used/search?${qs}`,
    ];

    for (const url of candidates) {
      console.log('Finn prøver:', url.substring(0, 90));
      const { status, body } = await httpsGet(url);
      console.log('Finn svar:', status, body.substring(0, 100));

      if (status === 403) return res.status(403).json({ error: 'Finn blokkerer IP', docs: [] });
      if (status === 404) continue;

      try {
        const data = JSON.parse(body);
        const docs = data?.docs || data?.response?.docs || [];
        console.log(`Finn: ${docs.length} annonser`);
        return res.json(data);
      } catch (e) {
        console.warn('Ikke JSON:', body.substring(0, 50));
        continue;
      }
    }

    res.json({ docs: [], metadata: { result_size: { match_count: 0 } } });
  } catch (err) {
    console.error('Finn feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
