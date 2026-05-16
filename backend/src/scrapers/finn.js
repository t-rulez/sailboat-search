'use strict';
const { interceptApiResponse, debugAllRequests } = require('./browser');

const FINN_SEARCH = 'https://www.finn.no/boat/used/search';

function buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    searchkey: 'BOAT_USED', q,
    price_from: priceMin, price_to: priceMax,
    year_from: yearMin,
    boat_length_from: sizeMin, boat_length_to: sizeMax,
    sort: '1',
  });
  return `${FINN_SEARCH}?${params}`;
}

function parseDoc(doc) {
  const priceRaw = doc.price?.amount ?? doc.price ?? null;
  const price = typeof priceRaw === 'object' ? priceRaw?.amount : priceRaw;
  return {
    source: 'finn',
    external_id: String(doc.finnkode || doc.id || ''),
    url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${doc.finnkode}`,
    title: doc.heading || doc.main_search_heading || 'Ukjent',
    brand: doc.make || doc.brand || null,
    boat_type: 'katamaran',
    price_nok: price ? Math.round(price) : null,
    price_original: price ? Math.round(price) : null,
    currency: 'NOK',
    year: doc.year || doc.model_year || null,
    length_ft: doc.boat_length ? parseFloat(doc.boat_length) : null,
    image_url: doc.main_search_image?.url || doc.image?.url || null,
    location: doc.location || null,
  };
}

async function search(params) {
  const url = buildUrl(params);
  console.log('Finn URL:', url);

  // Debug: logg alle JSON-kall Finn.no gjør
  const allCalls = await debugAllRequests(url, 8000);

  // Finn JSON-kall som inneholder docs/listings
  for (const { url: resUrl, data } of allCalls) {
    // Hent full respons på nytt for kall som ser lovende ut
    if (resUrl.includes('search') || resUrl.includes('finn') || resUrl.includes('boat')) {
      // Prøv å parse
    }
  }

  // Intercept spesifikt
  const captured = await interceptApiResponse(url, {
    interceptPatterns: ['finn.no', 'finncdn', 'search-qf', 'api/search', 'boat'],
    waitMs: 8000,
  });

  for (const { data } of captured) {
    const docs = data?.docs || data?.response?.docs || data?.data?.docs || [];
    if (docs.length > 0) {
      console.log(`Finn: ${docs.length} annonser funnet`);
      return docs.map(parseDoc).filter((d) => d.external_id);
    }
  }

  console.log(`Finn: ${captured.length} JSON-kall fanget, ingen docs`);
  return [];
}

async function checkListing(listing) {
  try {
    const { fetchPage } = require('./browser');
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('Denne annonsen er solgt')) return 'sold';
    if (html.includes('Finner ikke siden')) return 'removed';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
