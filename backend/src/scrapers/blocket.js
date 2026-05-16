'use strict';
const cheerio = require('cheerio');
const { interceptApiResponse, fetchPage } = require('./browser');

const BLOCKET_SEARCH = 'https://www.blocket.se/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar';
const BLOCKET_BASE = 'https://www.blocket.se';
const FALLBACK_SEK_TO_NOK = 0.098;

function buildUrl({ brand, yearMin, priceMinSEK, priceMaxSEK }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q });
  if (yearMin)     params.append('year_from', yearMin);
  if (priceMinSEK) params.append('price_from', priceMinSEK);
  if (priceMaxSEK) params.append('price_to', priceMaxSEK);
  return `${BLOCKET_SEARCH}?${params}`;
}

function parseAd(ad, sekToNok) {
  const priceSEK = ad.price?.value ?? ad.list_price?.value ?? ad.price ?? null;
  const id = String(ad.ad_id || ad.id || '');
  return {
    source: 'blocket',
    external_id: id,
    url: ad.share_url || ad.url || `${BLOCKET_BASE}/annons/${id}`,
    title: ad.subject || ad.heading || ad.title || 'Ukjent',
    brand: null,
    boat_type: 'katamaran',
    price_nok: priceSEK ? Math.round(priceSEK * sekToNok) : null,
    price_original: priceSEK ? Math.round(priceSEK) : null,
    currency: 'SEK',
    year: ad.year || null,
    length_ft: null,
    image_url: ad.images?.[0]?.url || ad.main_image_url || null,
    location: ad.location?.name || ad.municipality_name || null,
  };
}

function extractFromHtml(html, sekToNok) {
  const $ = cheerio.load(html);
  const results = [];

  // __NEXT_DATA__
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      // Blocket lagrer annonser mange steder i treet
      const ads =
        json?.props?.pageProps?.initialState?.searchPage?.ads ||
        json?.props?.pageProps?.initialState?.listing?.items ||
        json?.props?.pageProps?.ads ||
        json?.props?.pageProps?.listings ||
        [];
      if (ads.length > 0) {
        console.log(`Blocket: ${ads.length} via __NEXT_DATA__`);
        return ads.map((ad) => parseAd(ad, sekToNok)).filter((d) => d.external_id);
      }
      // Logg alle pageProps-nøkler for debugging
      console.log('Blocket __NEXT_DATA__ pageProps keys:', Object.keys(json?.props?.pageProps || {}).join(', '));
    } catch (e) {
      console.warn('Blocket __NEXT_DATA__ feilet:', e.message);
    }
  }

  return results;
}

async function search(params, rates) {
  const sekToNok = rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;
  const priceMinSEK = params.priceMin ? Math.round(params.priceMin * nokToSek) : null;
  const priceMaxSEK = params.priceMax ? Math.round(params.priceMax * nokToSek) : null;

  const url = buildUrl({ ...params, priceMinSEK, priceMaxSEK });
  console.log('Blocket URL:', url);

  // Metode 1: Intercept Blocket sitt interne API
  try {
    const captured = await interceptApiResponse(url, {
      interceptPatterns: [
        'api.blocket.se',
        'blocket.se/api',
        '/search',
        'listings',
        'content',
      ],
      waitMs: 6000,
    });

    for (const { url: resUrl, data } of captured) {
      const ads =
        data?.data ||
        data?.ads ||
        data?.listings ||
        data?.items ||
        [];
      if (Array.isArray(ads) && ads.length > 0) {
        console.log(`Blocket: ${ads.length} via intercept (${resUrl.substring(0, 60)})`);
        return ads.map((ad) => parseAd(ad, sekToNok)).filter((d) => d.external_id);
      }
    }
    console.log(`Blocket intercept: ${captured.length} kall fanget`);
  } catch (e) {
    console.warn('Blocket intercept feilet:', e.message);
  }

  // Metode 2: HTML/__NEXT_DATA__
  try {
    const html = await fetchPage(url, 5000);
    const results = extractFromHtml(html, sekToNok);
    if (results.length > 0) return results;
    console.warn('Blocket: ingen data funnet');
  } catch (e) {
    console.warn('Blocket HTML feilet:', e.message);
  }

  return [];
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('Annonsen är såld') || html.includes('Annonsen är borttagen')) return 'sold';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
