'use strict';
const axios = require('axios');
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

  // Boat24 er blokkert av Cloudflare for Puppeteer
  // Prøv direkte axios-kall mot Boat24 sitt søke-API
  // Boat24 har et XML/JSON API som brukes av mobilappen
  const apiUrls = [
    `https://www.boat24.com/api/boats/?${new URLSearchParams({
      q: 'catamaran', 'country[]': 'NO', year_from: params.yearMin || 2018, format: 'json'
    })}`,
    `https://www.boat24.com/en/sailboats/api/?q=catamaran&country[]=NO&country[]=SE&country[]=DK`,
  ];

  for (const apiUrl of apiUrls) {
    try {
      const res = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.boat24.com/',
        },
        timeout: 10000,
      });
      const items = res.data?.boats || res.data?.listings || res.data?.results || res.data?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log(`Boat24: ${items.length} via direkte API`);
        return items.map((i) => parseItem(i, eurToNok)).filter((d) => d.external_id);
      }
    } catch (e) {
      console.log(`Boat24 API ${apiUrl.substring(0,60)}: ${e.response?.status || e.message}`);
    }
  }

  // Fallback: Puppeteer med debug
  const allCalls = await debugAllRequests(url, 10000);
  const captured = await interceptApiResponse(url, {
    interceptPatterns: ['boat24', 'api', 'boats', 'search'],
    waitMs: 10000,
  });

  for (const { url: resUrl, data } of captured) {
    const items = data?.boats || data?.listings || data?.results || data?.data?.boats || [];
    if (Array.isArray(items) && items.length > 0) {
      console.log(`Boat24: ${items.length} via Puppeteer intercept`);
      return items.map((i) => parseItem(i, eurToNok)).filter((d) => d.external_id);
    }
  }

  console.log(`Boat24: ${captured.length} kall fanget, ingen annonser`);
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
