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
        'x-finn-client': 'finn-web',
      }
    }, (res) => {
      // Følg redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Finn redirect ->', res.headers.location);
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

// Alle kjente Finn søke-URL-varianter
function buildCandidates(params) {
  return [
    // Nyeste format (2024-2025)
    `https://www.finn.no/api/search-qf?searchkey=BOAT_USED&${params}`,
    `https://www.finn.no/api/search-qf?searchkey=BOAT&${params}`,
    // Eldre format
    `https://www.finn.no/api/search-qf?searchkey=BAP_ALL&vertical=boat&${params}`,
    // Direkte søkeside som JSON
    `https://www.finn.no/boat/used/search?${params}&format=json`,
  ];
}

router.get('/', async (req, res) => {
  try {
    const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;

    const q = ['katamaran', brand].filter(Boolean).join(' ');
    const params = new URLSearchParams({
      q,
      price_from:       priceMin,
      price_to:         priceMax,
      year_from:        yearMin,
      boat_length_from: sizeMin,
      boat_length_to:   sizeMax,
      sort: '1',
      rows: '48',
      page: '1',
    }).toString();

    const candidates = buildCandidates(params);

    for (const url of candidates) {
      console.log('Finn prøver:', url.substring(0, 90));
      const { status, body } = await httpsGet(url);
      console.log('Finn svar:', status, body.substring(0, 120));

      if (status === 403) {
        return res.status(403).json({ error: 'Finn.no blokkerer denne serveren', docs: [] });
      }
      if (status === 404) continue;

      try {
        const data = JSON.parse(body);
        const docs = data?.docs || data?.response?.docs || [];
        if (docs.length >= 0) { // 0 er OK, bare tom søkeresultat
          console.log(`Finn: ${docs.length} annonser fra ${url.substring(30, 70)}`);
          return res.json(data);
        }
      } catch (e) {
        console.warn('Finn: ikke gyldig JSON fra', url.substring(30, 70));
        continue;
      }
    }

    // Ingen URL fungerte – returner tom liste men ikke feil
    console.warn('Finn: alle endepunkter feilet');
    res.json({ docs: [], metadata: { result_size: { match_count: 0 } } });
  } catch (err) {
    console.error('Finn proxy feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
});

module.exports = router;
