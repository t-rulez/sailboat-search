'use strict';
const cheerio = require('cheerio');
const { interceptApiResponse, fetchPage } = require('./browser');

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
  const lengthM = item.length ?? item.loa ?? item.lengthM ?? null;
  return {
    source: 'boat24',
    external_id: id,
    url: item.url?.startsWith('http') ? item.url
      : `https://www.boat24.com${item.url || `/en/sailboats/${item.slug || id}/`}`,
    title: [item.manufacturer, item.model, item.year].filter(Boolean).join(' ') || item.title || item.name || 'Ukjent',
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

function extractFromHtml(html, eurToNok) {
  const $ = cheerio.load(html);
  const results = [];

  $('script').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.includes('"boats"') && !text.includes('"listings"') && !text.includes('"results"') && !text.includes('"ads"')) return;
    try {
      const jsonMatch = text.match(/(?:=\s*)(\{.+\})\s*;?\s*$/s) || (text.startsWith('{') ? [null, text] : null);
      if (!jsonMatch) return;
      const json = JSON.parse(jsonMatch[1]);
      const items =
        json?.props?.pageProps?.boats ||
        json?.props?.pageProps?.listings ||
        json?.props?.pageProps?.results ||
        json?.boats || json?.listings || [];
      if (items.length > 0) {
        items.forEach((item) => {
          const parsed = parseItem(item, eurToNok);
          if (parsed.external_id) results.push(parsed);
        });
      }
      if (items.length > 0) console.log(`Boat24: ${items.length} via script-tag JSON`);
    } catch (e) {}
  });

  return results;
}

async function search(params, rates) {
  const eurToNok = rates?.EUR ?? FALLBACK_EUR_TO_NOK;
  const nokToEur = 1 / eurToNok;
  const priceMinEUR = params.priceMin ? Math.round(params.priceMin * nokToEur) : null;
  const priceMaxEUR = params.priceMax ? Math.round(params.priceMax * nokToEur) : null;

  const url = buildUrl({ ...params, priceMinEUR, priceMaxEUR });
  console.log('Boat24 URL:', url);

  // Metode 1: Intercept
  try {
    const captured = await interceptApiResponse(url, {
      interceptPatterns: [
        'boat24.com/api',
        '/api/boats',
        '/api/listings',
        '/api/search',
        'boats.json',
      ],
      waitMs: 6000,
    });

    for (const { url: resUrl, data } of captured) {
      const items =
        data?.boats || data?.listings || data?.results || data?.data?.boats || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log(`Boat24: ${items.length} via intercept`);
        return items.map((i) => parseItem(i, eurToNok)).filter((d) => d.external_id);
      }
    }
    console.log(`Boat24 intercept: ${captured.length} kall fanget`);
  } catch (e) {
    console.warn('Boat24 intercept feilet:', e.message);
  }

  // Metode 2: HTML
  try {
    const html = await fetchPage(url, 5000);
    const results = extractFromHtml(html, eurToNok);
    if (results.length > 0) return results;
    console.warn('Boat24: ingen data funnet. HTML-start:', html.substring(0, 400).replace(/\s+/g, ' '));
  } catch (e) {
    console.warn('Boat24 HTML feilet:', e.message);
  }

  return [];
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('no longer available') || html.includes('sold')) return 'sold';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
