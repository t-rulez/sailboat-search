'use strict';
const axios = require('axios');

// Blocket har et semi-åpent søke-API
const BLOCKET_API = 'https://api.blocket.se/search_bff/v1/content';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BaatSok/1.0)',
  'Accept': 'application/json',
  'Accept-Language': 'sv-SE,sv;q=0.9',
};

// Grov NOK/SEK-kurs – overskrives av live-kurs i refresh.js
const FALLBACK_SEK_TO_NOK = 0.098;

function buildUrl({ boatType, brand, yearMin, priceMinSEK, priceMaxSEK, sizeMin, sizeMax }) {
  const q = [boatType, brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    q,
    cg: '5020',        // Kategori: segelbåtar
    lim: '40',
    sort: 'rel',
    include: 'extend_with_shipping',
  });
  if (yearMin)     params.append('year_from', yearMin);
  if (priceMinSEK) params.append('price_from', priceMinSEK);
  if (priceMaxSEK) params.append('price_to', priceMaxSEK);
  return `${BLOCKET_API}?${params}`;
}

function parseItem(item, sekToNok) {
  const price = item.price?.value ?? null;
  const priceNok = price ? Math.round(price * sekToNok) : null;

  // Lengde: Blocket oppgir i meter
  const lengthM = item.parameters?.find(
    (p) => p.label?.toLowerCase().includes('längd') || p.id === 'boat_length'
  )?.value;
  const lengthFt = lengthM ? parseFloat((parseFloat(lengthM) / 0.3048).toFixed(1)) : null;

  const year = item.parameters?.find(
    (p) => p.label?.toLowerCase().includes('årsmodell') || p.id === 'model_year'
  )?.value;

  const brand = item.parameters?.find(
    (p) => p.label?.toLowerCase().includes('märke') || p.id === 'brand'
  )?.value;

  return {
    source: 'blocket',
    external_id: String(item.ad_id || item.id || ''),
    url: item.share_url || `https://www.blocket.se/annons/${item.ad_id}`,
    title: item.subject || item.heading || 'Ukjent tittel',
    brand: brand || null,
    boat_type: null,
    price_nok: priceNok,
    price_original: price ? Math.round(price) : null,
    currency: 'SEK',
    year: year ? parseInt(year) : null,
    length_ft: lengthFt,
    image_url: item.images?.[0]?.url || null,
    location: item.location?.name || item.municipality_name || null,
  };
}

async function search(params, rates) {
  const sekToNok = rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;

  const priceMinSEK = params.priceMin ? Math.round(params.priceMin * nokToSek) : null;
  const priceMaxSEK = params.priceMax ? Math.round(params.priceMax * nokToSek) : null;

  const url = buildUrl({ ...params, priceMinSEK, priceMaxSEK });

  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const items = res.data?.data || res.data?.items || res.data?.content || [];
    return items
      .map((item) => parseItem(item, sekToNok))
      .filter((d) => d.external_id);
  } catch (err) {
    // Blocket API kan returnere 403 – logg og returner tomt
    console.warn('Blocket søk feilet:', err.response?.status, err.message);
    return [];
  }
}

async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
    });
    const html = res.data;
    if (
      html.includes('Annonsen är såld') ||
      html.includes('Annonsen är borttagen') ||
      html.includes('"sold":true')
    ) {
      return 'sold';
    }
    if (res.status === 404) return 'removed';
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    console.warn(`Blocket checkListing feilet:`, err.message);
    return null;
  }
}

module.exports = { search, checkListing };
