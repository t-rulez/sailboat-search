'use strict';
const axios = require('axios');
const cheerio = require('cheerio');

// Blocket – bruker HTML-scraping siden API krever auth
const BLOCKET_BASE = 'https://www.blocket.se';
const BLOCKET_SEARCH = 'https://www.blocket.se/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

const FALLBACK_SEK_TO_NOK = 0.098;

function buildUrl({ boatType, brand, yearMin, priceMinSEK, priceMaxSEK }) {
  const q = [boatType, brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q });
  if (yearMin)     params.append('year_from', yearMin);
  if (priceMinSEK) params.append('price_from', priceMinSEK);
  if (priceMaxSEK) params.append('price_to', priceMaxSEK);
  return `${BLOCKET_SEARCH}?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function scrapeListings($, sekToNok) {
  const results = [];

  // Prøv å hente JSON fra next.js __NEXT_DATA__ script-tag
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const ads =
        json?.props?.pageProps?.initialState?.searchPage?.ads ||
        json?.props?.pageProps?.ads ||
        json?.props?.pageProps?.searchResult?.ads ||
        [];

      if (ads.length > 0) {
        console.log(`Blocket: fant ${ads.length} annonser via __NEXT_DATA__`);
        ads.forEach((ad) => {
          const priceSEK = ad.price?.value ?? ad.list_price?.value ?? null;
          const priceNok = priceSEK ? Math.round(priceSEK * sekToNok) : null;
          const id = String(ad.ad_id || ad.id || '');
          if (!id) return;
          results.push({
            source: 'blocket',
            external_id: id,
            url: ad.share_url || ad.url || `${BLOCKET_BASE}/annons/${id}`,
            title: ad.subject || ad.heading || 'Ukjent',
            brand: null,
            boat_type: null,
            price_nok: priceNok,
            price_original: priceSEK ? Math.round(priceSEK) : null,
            currency: 'SEK',
            year: ad.year || null,
            length_ft: null,
            image_url: ad.images?.[0]?.url || null,
            location: ad.location?.name || null,
          });
        });
        return results;
      }
    } catch (e) {
      console.warn('Blocket __NEXT_DATA__ parsing feilet:', e.message);
    }
  }

  // Fallback: HTML-scraping
  $('article, [data-testid*="listing"], [class*="ListItem"]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-ad-id') || $el.attr('data-id') || '';
    if (!id) return;

    const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
    const href = $el.find('a').first().attr('href') || '';
    const url = href.startsWith('http') ? href : `${BLOCKET_BASE}${href}`;
    const priceText = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
    const priceSEK = parsePrice(priceText);
    const priceNok = priceSEK ? Math.round(priceSEK * sekToNok) : null;
    const imgUrl = $el.find('img').first().attr('src') || null;

    if (!id || !title) return;
    results.push({
      source: 'blocket',
      external_id: id,
      url,
      title,
      brand: null,
      boat_type: null,
      price_nok: priceNok,
      price_original: priceSEK,
      currency: 'SEK',
      year: null,
      length_ft: null,
      image_url: imgUrl,
      location: null,
    });
  });

  return results;
}

async function search(params, rates) {
  const sekToNok = rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;
  const priceMinSEK = params.priceMin ? Math.round(params.priceMin * nokToSek) : null;
  const priceMaxSEK = params.priceMax ? Math.round(params.priceMax * nokToSek) : null;

  const url = buildUrl({ ...params, priceMinSEK, priceMaxSEK });
  console.log('Blocket URL:', url);

  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results = scrapeListings($, sekToNok);
    console.log(`Blocket: ${results.length} annonser funnet`);
    return results;
  } catch (err) {
    console.warn('Blocket søk feilet:', err.response?.status, err.message);
    return [];
  }
}

async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, { headers: HEADERS, timeout: 10000 });
    const html = res.data;
    if (html.includes('Annonsen är såld') || html.includes('Annonsen är borttagen')) return 'sold';
    if (res.status === 404) return 'removed';
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    return null;
  }
}

module.exports = { search, checkListing };
