'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.finn.no/',
        'Origin': 'https://www.finn.no',
      }
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Prøv flere kjente Finn-endepunkter i rekkefølge
const FINN_ENDPOINTS = [
  (params) => `https://www.finn.no/api/search-qf?${params}`,
  (params) => `https://www.finn.no/api/search?${params}`,
  (params) => `https://www.finn.no/boat/used/search.json?${params}`,
];

router.get('/', async (req, res) => {
  try {
    const {
      brand = '', yearMin = '', priceMin = '', priceMax = '',
      sizeMin = '', sizeMax = '',
    } = req.query;

    const q = ['katamaran', brand].filter(Boolean).join(' ');
    const params = new URLSearchParams({
      searchkey: 'BOAT_USED',
      q,
      price_from:       priceMin,
      price_to:         priceMax,
      year_from:        yearMin,
      boat_length_from: sizeMin,
      boat_length_to:   sizeMax,
      sort: '1',
      rows: '48',
      page: '1',
    });

    for (const buildUrl of FINN_ENDPOINTS) {
      const url = buildUrl(params);
      console.log('Finn prøver:', url);

      const { status, body } = await httpsGet(url);
      console.log('Finn svar:', status, body.substring(0, 80));

      if (status === 404) continue; // prøv neste endepunkt
      if (status === 403) {
        // Railway IP blokkert
        return res.status(403).json({ error: 'Finn.no blokkerer Railway sin IP', docs: [] });
      }

      try {
        const data = JSON.parse(body);
        const docs = data?.docs || data?.response?.docs || [];
        console.log(`Finn: ${docs.length} annonser funnet`);
        return res.json(data);
      } catch (e) {
        console.warn('Finn: ikke JSON, status', status);
        continue;
      }
    }

    // Alle endepunkter feilet
    res.status(404).json({ error: 'Finn.no API ikke tilgjengelig', docs: [] });
  } catch (err) {
    console.error('Finn proxy feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
