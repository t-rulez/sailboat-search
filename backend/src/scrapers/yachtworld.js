'use strict';
const cheerio = require('cheerio');
const { interceptApiResponse, fetchPage } = require('./browser');

const BASE_URL = 'https://www.yachtworld.com/boats-for-sale/type-sail/';
const FALLBACK_USD_TO_NOK = 10.5;

function buildUrl({ brand, yearMin, priceMinUSD, priceMaxUSD, sizeMin, sizeMax }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q, country: 'NO,SE,DK' });
  if (yearMin)     params.set('year_min', yearMin);
  if (sizeMin)     params.set('loa_min', Math.round(sizeMin * 0.3048));
  if (sizeMax)     params.set('loa_max', Math.round(sizeMax * 0.3048));
  if (priceMinUSD) params.set('price_min', priceMinUSD);
  if (priceMaxUSD) params.set('price_max', priceMaxUSD);
  return `${BASE_URL}?${params}`;
}

function parseItem(item, usdToNok) {
  const priceUSD = item.price?.amount ?? item.price ?? item.askingPrice ?? null;
  const id = String(item.id || item.listing_id || item.boatId || '');
  const lengthFt = item.length?.feet ?? item.loa ?? item.lengthFt ?? null;
  return {
    source: 'yachtworld',
    external_id: id,
    url: item.url?.startsWith('http') ? item.url
      : `https://www.yachtworld.com${item.url || `/boats-for-sale/${id}/`}`,
    title: [item.make, item.model, item.year].filter(Boolean).join(' ') || item.heading || 'Ukjent',
    brand: item.make || item.manufacturer || null,
    boat_type: 'katamaran',
    price_nok: priceUSD ? Math.round(priceUSD * usdToNok) : null,
    price_original: priceUSD ? Math.round(priceUSD) : null,
    currency: 'USD',
    year: item.year || null,
    length_ft: lengthFt ? parseFloat(lengthFt) : null,
    image_url: item.media?.[0]?.url || item.images?.[0]?.url || item.heroImage || null,
    location: item.location?.city || item.location?.country || item.countryCode || null,
  };
}

function extractFromHtml(html, usdToNok) {
  const $ = cheerio.load(html);
  const results = [];
  $('script').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.includes('listings') && !text.includes('boats')) return;
    try {
      // Kan være window.__INITIAL_STATE__ = {...}
      const jsonMatch = text.match(/(?:window\.__(?:INITIAL_STATE|DATA)__\s*=\s*)(\{.+\})/) ||
                        text.match(/^(\{.+\})$/s);
      if (!jsonMatch) return;
      const json = JSON.parse(jsonMatch[1]);
      const listings =
        json?.searchResults?.listings ||
        json?.props?.pageProps?.searchResults?.listings ||
        json?.listings ||
        json?.boats ||
        [];
      listings.forEach((item) => {
        const parsed = parseItem(item, usdToNok);
        if (parsed.external_id) results.push(parsed);
      });
    } catch (e) {}
  });
  return results;
}

async function search(params, rates) {
  const usdToNok = rates?.USD ?? FALLBACK_USD_TO_NOK;
  const nokToUsd = 1 / usdToNok;
  const priceMinUSD = params.priceMin ? Math.round(params.priceMin * nokToUsd) : null;
  const priceMaxUSD = params.priceMax ? Math.round(params.priceMax * nokToUsd) : null;

  const url = buildUrl({ ...params, priceMinUSD, priceMaxUSD });
  console.log('Yachtworld URL:', url);

  // Metode 1: Intercept internt API
  try {
    const captured = await interceptApiResponse(url, {
      interceptPatterns: [
        'yachtworld.com/api',
        '/search',
        'listings',
        'boats-for-sale',
      ],
      waitMs: 6000,
    });

    for (const { data } of captured) {
      const listings =
        data?.searchResults?.listings ||
        data?.listings ||
        data?.boats ||
        data?.data?.listings ||
        [];
      if (listings.length > 0) {
        console.log(`Yachtworld: ${listings.length} via intercept`);
        return listings.map((i) => parseItem(i, usdToNok)).filter((d) => d.external_id);
      }
    }
    console.log(`Yachtworld intercept: ${captured.length} kall fanget, ingen listings`);
  } catch (e) {
    console.warn('Yachtworld intercept feilet:', e.message);
  }

  // Metode 2: HTML-parsing
  try {
    const html = await fetchPage(url, 5000);
    const results = extractFromHtml(html, usdToNok);
    if (results.length > 0) {
      console.log(`Yachtworld: ${results.length} via HTML`);
      return results;
    }
    console.warn('Yachtworld: ingen data. HTML-start:', html.substring(0, 300).replace(/\s+/g, ' '));
  } catch (e) {
    console.warn('Yachtworld HTML feilet:', e.message);
  }

  return [];
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('no longer available') || html.includes('listing has been sold')) return 'sold';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
