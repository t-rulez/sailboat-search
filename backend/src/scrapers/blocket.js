'use strict';
const { interceptApiResponse } = require('./browser');

const BLOCKET_BASE = 'https://www.blocket.se';
// Blocket sitt interne søke-API (oppdaget via nettverksanalyse)
const BLOCKET_API = 'https://www.blocket.se/recommerce/forsale/search/api/listings';
const FALLBACK_SEK_TO_NOK = 0.098;

function buildSearchUrl({ brand, yearMin, priceMinSEK, priceMaxSEK }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  // Blocket sin søkeside – vi besøker denne for å trigge API-kallet
  const params = new URLSearchParams({ q });
  if (yearMin)     params.append('year_from', yearMin);
  if (priceMinSEK) params.append('price_from', priceMinSEK);
  if (priceMaxSEK) params.append('price_to', priceMaxSEK);
  return `${BLOCKET_BASE}/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar?${params}`;
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

async function search(params, rates) {
  const sekToNok = rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;
  const priceMinSEK = params.priceMin ? Math.round(params.priceMin * nokToSek) : null;
  const priceMaxSEK = params.priceMax ? Math.round(params.priceMax * nokToSek) : null;

  const pageUrl = buildSearchUrl({ ...params, priceMinSEK, priceMaxSEK });
  console.log('Blocket URL:', pageUrl);

  // Blocket laster resultater via et intern API etter cookie-consent
  // Vi intercepter ALLE kall fra blocket.se-domenet
  const captured = await interceptApiResponse(pageUrl, {
    interceptPatterns: [
      'blocket.se/recommerce/forsale/search',
      'blocket.se/api',
      '/listings',
      '/ads',
      '/search/result',
    ],
    waitMs: 12000, // Lenger ventetid for cookie-consent + lasting
  });

  console.log(`Blocket: ${captured.length} relevante JSON-kall fanget`);
  captured.forEach(({ url: u }) => console.log('  -', u.substring(0, 100)));

  for (const { url: resUrl, data } of captured) {
    // Blocket returnerer annonser i data.data (array)
    const ads = Array.isArray(data?.data) ? data.data
      : data?.ads || data?.listings || data?.items
      || data?.result?.ads || data?.result?.items || [];

    if (ads.length > 0) {
      console.log(`Blocket: ${ads.length} annonser fra ${resUrl.substring(0, 60)}`);
      return ads.map((ad) => parseAd(ad, sekToNok)).filter((d) => d.external_id);
    }
  }

  console.log('Blocket: ingen annonser funnet i noen av kallene');
  return [];
}

async function checkListing(listing) {
  try {
    const { fetchPage } = require('./browser');
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('Annonsen är såld')) return 'sold';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
