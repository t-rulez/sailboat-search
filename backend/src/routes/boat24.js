'use strict';
const express = require('express');
const router = express.Router();
const https = require('https');
const cheerio = require('cheerio');

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

function buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page = 1 }) {
  const params = new URLSearchParams();
  if (brand)    params.set('src', brand);
  params.set('cat', '1');
  params.append('typ[]', '231');  // Katamaran
  params.set('whr', 'NOK');
  if (priceMin) params.set('prs_min', priceMin);
  if (priceMax) params.set('prs_max', priceMax);
  if (sizeMin)  params.set('lge_min', Math.round(parseInt(sizeMin) * 0.3048));
  if (sizeMax)  params.set('lge_max', Math.round(parseInt(sizeMax) * 0.3048));
  if (yearMin)  params.set('jhr_min', yearMin);
  params.append('rgo[]', '43');  // Norge
  params.append('rgo[]', '49');  // Sverige
  params.append('rgo[]', '15');  // Danmark
  params.set('slt', '0');
  if (page > 1) params.set('pg', page);
  return `https://www.boat24.com/no/seilbater/?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  // "NOK 3 940 000,-" → 3940000
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseListings($) {
  const results = [];

  $('.blurb').each((_, el) => {
    const $el = $(el);

    // ID fra data-id på bookmark
    const id = $el.find('.blurb__bookmark').attr('data-id') || '';
    if (!id) return;

    // Tittel og URL
    const $titleLink = $el.find('.blurb__title a');
    const title = $titleLink.text().trim();
    const url = $titleLink.attr('href') || '';
    if (!title || !url) return;

    // Pris
    const priceText = $el.find('.blurb__price').first().text().trim();
    const priceNok = parsePrice(priceText);

    // År — finn <span class="blurb__key"> som inneholder "Årgang"
    let year = null;
    $el.find('.blurb__fact').each((_, fact) => {
      const key = $(fact).find('.blurb__key').text().trim();
      if (key === 'Årgang') {
        const val = parseInt($(fact).find('.blurb__value').text().trim());
        if (!isNaN(val)) year = val;
      }
    });
    // Fallback: sjekk blurb__description
    if (!year) {
      $el.find('.blurb__description li').each((_, li) => {
        const m = $(li).text().match(/Årgang (\d{4})/);
        if (m) year = parseInt(m[1]);
      });
    }

    // Sted
    const location = $el.find('.blurb__location').first().text()
      .replace(/»/g, '·').replace(/\s+/g, ' ').trim() || null;

    // Bilde — første data-srcset
    const imgSrcset = $el.find('.slider__slide').first().find('img').attr('data-srcset') || '';
    const imgMatch = imgSrcset.match(/https?:\/\/[^\s,]+\.jpg/);
    const imageUrl = imgMatch ? imgMatch[0] : null;

    // Merke fra URL: /no/seilbater/lagoon/lagoon-40/detail/...
    const brandMatch = url.match(/\/seilbater\/([^/]+)\//);
    const brand = brandMatch ? brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1) : null;

    results.push({
      source: 'boat24',
      external_id: id,
      url: url.startsWith('http') ? url : `https://www.boat24.com${url}`,
      title,
      brand,
      boat_type: 'katamaran',
      price_nok: priceNok,
      price_original: priceNok,
      currency: 'NOK',
      year,
      length_ft: null,
      image_url: imageUrl,
      location,
      status: 'active',
    });
  });

  return results;
}

function parseTotalPages($) {
  // Se etter pagineringsinfo
  const paginationText = $('.pagination, [class*="pag"]').text();
  const match = paginationText.match(/av\s+(\d+)/i) || paginationText.match(/\/\s*(\d+)/);
  if (match) return parseInt(match[1]);

  // Alternativt: tell antall sider fra nav
  let maxPage = 1;
  $('a[href*="pg="]').each((_, el) => {
    const m = $(el).attr('href')?.match(/pg=(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1]));
  });
  return maxPage;
}

// ─── GET /api/boat24/debug ───────────────────────────────
router.get('/debug', async (req, res) => {
  const url = buildUrl({});
  console.log('Boat24 debug URL:', url);
  const { status, body } = await httpsGet(url).catch(e => ({ status: 'ERR', body: e.message }));
  const $ = cheerio.load(body);
  const docs = parseListings($);
  const totalPages = parseTotalPages($);

  res.json({
    url, status,
    bodyLength: body.length,
    totalPages,
    docsFound: docs.length,
    firstDoc: docs[0] || null,
    docs: docs.slice(0, 3),
  });
});

// ─── GET /api/boat24 ────────────────────────────────────
router.get('/', async (req, res) => {
  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;

  try {
    const allDocs = [];
    const url1 = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page: 1 });
    console.log('Boat24 søkeparametere:', { brand, yearMin, priceMin, priceMax });
    console.log('Boat24 side 1:', url1);

    const { status, body: body1 } = await httpsGet(url1);
    console.log('Boat24 svar:', status, 'length:', body1.length);

    if (status === 403) return res.status(403).json({ error: 'Boat24 blokkerer IP', docs: [] });

    const $ = cheerio.load(body1);
    const page1Docs = parseListings($);
    const totalPages = parseTotalPages($);
    allDocs.push(...page1Docs);
    console.log(`Boat24 side 1: ${page1Docs.length} annonser, ${totalPages} sider totalt`);

    const maxPages = Math.min(totalPages, 10);
    if (maxPages > 1) {
      const pageNums = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          const url = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page });
          const { body } = await httpsGet(url);
          const $p = cheerio.load(body);
          const docs = parseListings($p);
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
