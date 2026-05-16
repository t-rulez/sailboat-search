'use strict';
const { interceptApiResponse, debugAllRequests } = require('./browser');

const FALLBACK_USD_TO_NOK = 10.5;

// Yachtworld har separate URLer per land – vi søker alle tre
function buildUrls({ brand, yearMin, priceMinUSD, priceMaxUSD, sizeMin, sizeMax }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const countries = [
    { code: 'NO', base: 'https://www.yachtworld.com/boats-for-sale/type-sail/country-norway/' },
    { code: 'SE', base: 'https://www.yachtworld.com/boats-for-sale/type-sail/country-sweden/' },
    { code: 'DK', base: 'https://www.yachtworld.com/boats-for-sale/type-sail/country-denmark/' },
  ];

  return countries.map(({ code, base }) => {
    const params = new URLSearchParams({ q });
    if (yearMin)     params.set('year_min', yearMin);
    if (sizeMin)     params.set('loa_min', Math.round(sizeMin * 0.3048));
    if (sizeMax)     params.set('loa_max', Math.round(sizeMax * 0.3048));
    if (priceMinUSD) params.set('price_min', priceMinUSD);
    if (priceMaxUSD) params.set('price_max', priceMaxUSD);
    return { code, url: `${base}?${params}` };
  });
}

function parseItem(item, usdToNok) {
  const priceUSD = item.price?.amount ?? item.price?.value ?? item.price ?? item.askingPrice ?? null;
  const id = String(item.id || item.listing_id || item.boatId || '');
  const lengthFt = item.length?.feet ?? item.loa ?? item.lengthFt ?? null;
  return {
    source: 'yachtworld',
    external_id: id,
    url: item.url?.startsWith('http') ? item.url : `https://www.yachtworld.com${item.url || `/boats-for-sale/${id}/`}`,
    title: [item.make, item.model, item.year].filter(Boolean).join(' ') || item.heading || 'Ukjent',
    brand: item.make || item.manufacturer || null,
    boat_type: 'katamaran',
    price_nok: priceUSD ? Math.round(priceUSD * usdToNok) : null,
    price_original: priceUSD ? Math.round(priceUSD) : null,
    currency: 'USD',
    year: item.year || null,
    length_ft: lengthFt ? parseFloat(lengthFt) : null,
    image_url: item.media?.[0]?.url || item.images?.[0]?.url || item.heroImage || null,
    location: item.location?.city || item.location?.country || null,
  };
}

async function searchOne(url, usdToNok) {
  console.log('Yachtworld URL:', url);

  const allCalls = await debugAllRequests(url, 10000);

  const captured = await interceptApiResponse(url, {
    interceptPatterns: ['yachtworld', 'api', 'search', 'listing', 'boat'],
    waitMs: 10000,
  });

  for (const { url: resUrl, data } of captured) {
    const listings =
      data?.searchResults?.listings ||
      data?.listings || data?.boats ||
      data?.data?.listings || data?.data?.boats || [];
    if (listings.length > 0) {
      console.log(`Yachtworld: ${listings.length} annonser fra ${resUrl.substring(0,60)}`);
      return listings.map((i) => parseItem(i, usdToNok)).filter((d) => d.external_id);
    }
  }
  return [];
}

async function search(params, rates) {
  const usdToNok = rates?.USD ?? FALLBACK_USD_TO_NOK;
  const nokToUsd = 1 / usdToNok;
  const priceMinUSD = params.priceMin ? Math.round(params.priceMin * nokToUsd) : null;
  const priceMaxUSD = params.priceMax ? Math.round(params.priceMax * nokToUsd) : null;

  const urls = buildUrls({ ...params, priceMinUSD, priceMaxUSD });
  const allResults = [];

  for (const { code, url } of urls) {
    try {
      const results = await searchOne(url, usdToNok);
      console.log(`Yachtworld ${code}: ${results.length} annonser`);
      allResults.push(...results);
    } catch (e) {
      console.warn(`Yachtworld ${code} feilet:`, e.message);
    }
  }

  // Dedupliser på external_id
  const seen = new Set();
  return allResults.filter((r) => {
    if (seen.has(r.external_id)) return false;
    seen.add(r.external_id);
    return true;
  });
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
