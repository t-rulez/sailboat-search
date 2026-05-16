'use strict';
const axios = require('axios');

const FINN_API = 'https://www.finn.no/api/search-qf';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BaatSok/1.0)',
  'Accept': 'application/json',
  'Accept-Language': 'no-NO,no;q=0.9',
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
  return `${FINN_API}?${params}`;
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
  const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const data = res.data;
  const docs = data?.docs || data?.response?.docs || [];
  return docs.map(parseDoc).filter((d) => d.external_id);
}

// Sjekker status på én enkelt annonse
async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
      maxRedirects: 5,
    });
    const html = res.data;

    // Finn marker annonser som solgt på ulike måter
    if (
      html.includes('Denne annonsen er solgt') ||
      html.includes('Annonsen er slettet') ||
      html.includes('"status":"inactive"') ||
      html.includes('"sold":true')
    ) {
      return 'sold';
    }
    if (res.status === 404 || html.includes('Finner ikke siden')) {
      return 'removed';
    }
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    console.warn(`Finn checkListing feilet for ${listing.url}:`, err.message);
    return null; // null = ukjent, ikke oppdater status
  }
}

module.exports = { search, checkListing };
