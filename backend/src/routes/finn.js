'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');

// ─── GET /api/finn ───────────────────────────────────────
// Proxy for Finn.no søk – unngår CORS-blokkering i nettleseren

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.finn.no/',
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

    const url = `https://www.finn.no/api/search-qf?${params}`;
    console.log('Finn proxy:', url);

    const { status, body } = await httpsGet(url);

    if (status !== 200) {
      console.warn('Finn svarte:', status, body.substring(0, 100));
      return res.status(status).json({ error: `Finn svarte med ${status}`, docs: [] });
    }

    const data = JSON.parse(body);
    res.json(data);
  } catch (err) {
    console.error('Finn proxy feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
