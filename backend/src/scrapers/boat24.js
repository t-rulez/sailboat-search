'use strict';
const { interceptApiResponse, debugAllRequests } = require('./browser');

const BASE_URL = 'https://www.boat24.com/en/sailboats/';
const FALLBACK_EUR_TO_NOK = 11.8;

function buildUrl({ brand, yearMin, priceMinEUR, priceMaxEUR, sizeMin, sizeMax }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q });
  ['NO', 'SE', 'DK'].forEach((c) => params.append('country[]', c));
  if (yearMin)     params.set('year_from', yearMin);
  if (priceMinEUR) params.set('price_from', priceMinEUR);
  if (priceMaxEUR) params.set('price_to', priceMaxEUR);
  if (sizeMin)     params.set('length_from', Math.round(sizeMin * 0.3048));
  if (sizeMax)     params.set('length_to', Math.round(sizeMax * 0.3048));
  return `${BASE_URL}?${params}`;
}

function parseItem(item, eurToNok) {
  const priceEUR = item.price?.amount ?? item.price?.value ?? item.price ?? null;
  const id = String(item.id || item.boat_id || item.adId || '');
  const lengthM = item.length ?? item.loa ?? null;
  return {
    source: 'boat24',
    external_id: id,
    url: item.url?.startsWith('http') ? item.url : `https://www.boat24.com${item.url || `/en/sailboats/${item.slug || id}/`}`,
    title: [item.manufacturer, item.model, item.year].filter(Boolean).join(' ') || item.title || 'Ukjent',
    brand: item.manufacturer || item.make || null,
    boat_type: 'katamaran',
    price_nok: priceEUR ? Math.round(priceEUR * eurToNok) : null,
    price_original: priceEUR ? Math.round(priceEUR) : null,
    currency: 'EUR',
    year: item.year || null,
    length_ft: lengthM ? parseFloat((lengthM / 0.3048).toFixed(1)) : null,
    image_url: item.images?.[0]?.url || item.mainImage || item.thumbnail || null,
    location: item.country || item.location?.country || null,
  };
}

async function search(params, rates) {
  const eurToNok = rates?.EUR ?? FALLBACK_EUR_TO_NOK;
  const nokToEur = 1 / eurToNok;
  const priceMinEUR = params.priceMin ? Math.round(params.priceMin * nokToEur) : null;
  const priceMaxEUR = params.priceMax ? Math.round(params.priceMax * nokToEur) : null;

  const url = buildUrl({ ...params, priceMinEUR, priceMaxEUR });
  console.log('Boat24 URL:', url);

  // Debug: se alle JSON-kall
  const allCalls = await debugAllRequests(url, 8000);

  // Intercept bredt
  const captured = await interceptApiResponse(url, {
    interceptPatterns: ['boat24', 'api', 'boats', 'search', 'listings'],
    waitMs: 8000,
  });

  for (const { url: resUrl, data } of captured) {
    const items =
      data?.boats || data?.listings || data?.results ||
      data?.data?.boats || data?.data?.listings || [];
    if (Array.isArray(items) && items.length > 0) {
      console.log(`Boat24: ${items.length} annonser`);
      return items.map((i) => parseItem(i, eurToNok)).filter((d) => d.external_id);
    }
  }

  console.log(`Boat24: ${captured.length} JSON-kall fanget, ingen annonser`);
  return [];
}

async function checkListing(listing) {
  try {
    const { fetchPage } = require('./browser');
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('no longer available')) return 'sold';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
