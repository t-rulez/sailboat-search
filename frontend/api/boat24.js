// Vercel Serverless Function – proxy for Boat24
// Kjøres på Vercels edge-nettverk, ikke blokkert av Boat24

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'no-NO,no;q=0.9',
        'Referer': 'https://www.boat24.com/',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page = 1 }) {
  const params = new URLSearchParams();
  if (brand)    params.set('src', brand);
  params.set('cat', '1');
  params.append('typ[]', '231');
  params.set('whr', 'NOK');
  if (priceMin) params.set('prs_min', priceMin);
  if (priceMax) params.set('prs_max', priceMax);
  if (sizeMin)  params.set('lge_min', Math.round(parseInt(sizeMin) * 0.3048));
  if (sizeMax)  params.set('lge_max', Math.round(parseInt(sizeMax) * 0.3048));
  if (yearMin)  params.set('jhr_min', yearMin);
  params.append('rgo[]', '43');
  params.append('rgo[]', '49');
  params.append('rgo[]', '15');
  params.set('slt', '0');
  if (page > 1) params.set('pg', page);
  return `https://www.boat24.com/no/seilbater/?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseListings(html) {
  const results = [];
  // Parse blurb blocks med regex siden vi ikke har cheerio i Vercel functions
  const blurbRegex = /<div class="blurb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/li>/g;

  // Enklere: parse direkte etter kjente mønstre
  const idRegex = /data-id="(\d+)"/g;
  const titleRegex = /<h3 class="blurb__title"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const priceRegex = /<p class="blurb__price">([^<]+)<\/p>/g;
  const yearRegex = /<span class="blurb__value">(\d{4})<\/span><span class="blurb__key">Årgang<\/span>/g;
  const locationRegex = /<p class="blurb__location">([^<]+)/g;
  const imgRegex = /data-srcset="(https:\/\/static\.b24\.co\/fotos\/small\/[^\s,]+\.jpg)/g;

  const ids = [...html.matchAll(idRegex)].map(m => m[1]);
  const titles = [...html.matchAll(titleRegex)].map(m => ({ url: m[1], title: m[2] }));
  const prices = [...html.matchAll(priceRegex)].map(m => parsePrice(m[1]));
  const years = [...html.matchAll(yearRegex)].map(m => parseInt(m[1]));
  const locations = [...html.matchAll(locationRegex)].map(m => 
    m[1].replace(/&raquo;/g, '·').replace(/\s+/g, ' ').trim()
  );
  const imgs = [...html.matchAll(imgRegex)].map(m => m[1]);
  // Dedupliser bilder (en per annonse)
  const uniqueImgs = [];
  const seenImgIds = new Set();
  for (const img of imgs) {
    const idMatch = img.match(/\/small\/(\d+)-/);
    if (idMatch && !seenImgIds.has(idMatch[1])) {
      seenImgIds.add(idMatch[1]);
      uniqueImgs.push(img);
    }
  }

  for (let i = 0; i < titles.length; i++) {
    const id = ids[i] || String(i);
    const { url, title } = titles[i];
    const brandMatch = url.match(/\/seilbater\/([^/]+)\//);
    const brand = brandMatch ? brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1) : null;

    results.push({
      source: 'boat24',
      external_id: id,
      url: url.startsWith('http') ? url : `https://www.boat24.com${url}`,
      title: title.trim(),
      brand,
      boat_type: 'katamaran',
      price_nok: prices[i] || null,
      price_original: prices[i] || null,
      currency: 'NOK',
      year: years[i] || null,
      length_ft: null,
      image_url: uniqueImgs[i] || null,
      location: locations[i] || null,
      status: 'active',
    });
  }
  return results;
}

function parseTotalPages(html) {
  let maxPage = 1;
  const pgMatches = [...html.matchAll(/pg=(\d+)/g)];
  for (const m of pgMatches) {
    maxPage = Math.max(maxPage, parseInt(m[1]));
  }
  return maxPage;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { brand = '', yearMin = '', priceMin = '', priceMax = '', sizeMin = '', sizeMax = '' } = req.query;

  try {
    const allDocs = [];
    const url1 = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page: 1 });
    console.log('Boat24 Vercel proxy URL:', url1);

    const { status, body: body1 } = await httpsGet(url1);
    console.log('Boat24 status:', status, 'len:', body1.length);

    if (status === 403) {
      return res.status(403).json({ error: 'Boat24 blokkerer', docs: [] });
    }

    const page1Docs = parseListings(body1);
    const totalPages = parseTotalPages(body1);
    allDocs.push(...page1Docs);
    console.log(`Boat24 side 1: ${page1Docs.length} annonser, ${totalPages} sider`);

    const maxPages = Math.min(totalPages, 10);
    if (maxPages > 1) {
      const pageNums = Array.from({ length: maxPages - 1 }, (_, i) => i + 2);
      const pageResults = await Promise.all(
        pageNums.map(async (page) => {
          const url = buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, page });
          const { body } = await httpsGet(url);
          return parseListings(body);
        })
      );
      pageResults.forEach(docs => allDocs.push(...docs));
    }

    res.json({ docs: allDocs });
  } catch (err) {
    console.error('Boat24 Vercel feil:', err.message);
    res.status(500).json({ error: err.message, docs: [] });
  }
};
