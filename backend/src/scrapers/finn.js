'use strict';
const axios = require('axios');

// Finn.no sitt søke-API – oppdatert endepunkt
const FINN_SEARCH = 'https://www.finn.no/api/search-qf';
const FINN_SEARCH_V2 = 'https://www.finn.no/boat/used/search';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'no-NO,no;q=0.9,en;q=0.8',
  'Referer': 'https://www.finn.no/',
};

function buildUrl({ boatType, brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const q = [boatType, brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    searchkey: 'BOAT_USED',
    q,
    price_from: priceMin,
    price_to: priceMax,
    year_from: yearMin,
    boat_length_from: sizeMin,
    boat_length_to: sizeMax,
    sort: '1',
    rows: '48',
    page: '1',
  });
  return `${FINN_SEARCH}?${params}`;
}

function parseDoc(doc) {
  const priceRaw = doc.price?.amount ?? doc.price ?? null;
  const price = typeof priceRaw === 'object' ? priceRaw?.amount : priceRaw;
  const lengthRaw = doc.boat_length ?? doc.length ?? null;

  return {
    source: 'finn',
    external_id: String(doc.finnkode || doc.id || ''),
    url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${doc.finnkode}`,
    title: doc.heading || doc.main_search_heading || 'Ukjent tittel',
    brand: doc.make || doc.brand || doc.manufacturer || null,
    boat_type: doc.boat_type_name || null,
    price_nok: price ? Math.round(price) : null,
    price_original: price ? Math.round(price) : null,
    currency: 'NOK',
    year: doc.year || doc.model_year || null,
    length_ft: lengthRaw ? parseFloat(lengthRaw) : null,
    image_url: doc.main_search_image?.url || doc.image?.url || doc.images?.[0]?.url || null,
    location: doc.location || null,
  };
}

async function search(params) {
  const url = buildUrl(params);
  console.log('Finn URL:', url);

  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
  });

  const data = res.data;
  const docs = data?.docs || data?.response?.docs || data?.data?.docs || [];
  console.log(`Finn: rådata nøkler: ${Object.keys(data).join(', ')}, docs: ${docs.length}`);
  return docs.map(parseDoc).filter((d) => d.external_id);
}

async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
      maxRedirects: 5,
    });
    const html = res.data;
    if (
      html.includes('Denne annonsen er solgt') ||
      html.includes('Annonsen er slettet') ||
      html.includes('"status":"inactive"') ||
      html.includes('"sold":true')
    ) return 'sold';
    if (res.status === 404 || html.includes('Finner ikke siden')) return 'removed';
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    return null;
  }
}

module.exports = { search, checkListing };
