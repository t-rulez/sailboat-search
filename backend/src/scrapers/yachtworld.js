'use strict';
const cheerio = require('cheerio');
const { fetchPage } = require('./browser');

// Yachtworld – Norge, Sverige, Danmark – seilbåter
// Priser i USD
const BASE_URL = 'https://www.yachtworld.com/boats-for-sale/type-sail/';
const FALLBACK_USD_TO_NOK = 10.5;

function buildUrl({ brand, yearMin, priceMinUSD, priceMaxUSD, sizeMin, sizeMax }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    q,
    country: 'NO,SE,DK',
    year_min: yearMin || '',
    loa_min: sizeMin ? Math.round(sizeMin * 0.3048) : '',  // fot → meter
    loa_max: sizeMax ? Math.round(sizeMax * 0.3048) : '',
  });
  if (priceMinUSD) params.set('price_min', priceMinUSD);
  if (priceMaxUSD) params.set('price_max', priceMaxUSD);
  return `${BASE_URL}?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function scrapeListings($, usdToNok) {
  const results = [];

  // Prøv __NEXT_DATA__ / window.__INITIAL_STATE__
  $('script').each((_, el) => {
    const text = $(el).text();
    if (!text.includes('"listings"') && !text.includes('"boats"')) return;
    try {
      const json = JSON.parse(text);
      const listings =
        json?.searchResults?.listings ||
        json?.props?.pageProps?.searchResults?.listings ||
        json?.props?.pageProps?.boats ||
        json?.listings ||
        [];
      if (!listings.length) return;

      console.log(`YW: ${listings.length} via JSON`);
      listings.forEach((item) => {
        const priceUSD = item.price?.amount ?? item.price ?? null;
        const id = String(item.id || item.listing_id || '');
        if (!id) return;
        results.push({
          source: 'yachtworld',
          external_id: id,
          url: item.url?.startsWith('http') ? item.url : `https://www.yachtworld.com${item.url || `/boats-for-sale/${id}/`}`,
          title: item.make_model || item.heading || item.name || 'Ukjent',
          brand: item.make || item.manufacturer || null,
          boat_type: 'katamaran',
          price_nok: priceUSD ? Math.round(priceUSD * usdToNok) : null,
          price_original: priceUSD ? Math.round(priceUSD) : null,
          currency: 'USD',
          year: item.year || null,
          length_ft: item.length?.feet ?? item.loa ?? null,
          image_url: item.media?.[0]?.url || item.images?.[0]?.url || item.thumbnail || null,
          location: item.location?.city || item.location?.country || null,
        });
      });
    } catch (e) { /* ikke gyldig JSON */ }
  });

  if (results.length > 0) return results;

  // Fallback: HTML-scraping av kort
  $('[class*="SearchResult"], [class*="listing-card"], article[class*="boat"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a').first().attr('href') || '';
    const idMatch = href.match(/\/(\d+)\/?$/);
    const id = idMatch?.[1] || $el.attr('data-id') || '';
    if (!id) return;

    const title = $el.find('h2, h3, [class*="title"], [class*="make"]').first().text().trim();
    const priceText = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
    const priceUSD = parsePrice(priceText);
    const imgUrl = $el.find('img').first().attr('src') || null;
    const yearText = $el.find('[class*="year"]').first().text().trim();
    const year = parseInt(yearText) || null;

    if (!id || !title) return;
    results.push({
      source: 'yachtworld',
      external_id: id,
      url: href.startsWith('http') ? href : `https://www.yachtworld.com${href}`,
      title,
      brand: null,
      boat_type: 'katamaran',
      price_nok: priceUSD ? Math.round(priceUSD * usdToNok) : null,
      price_original: priceUSD,
      currency: 'USD',
      year,
      length_ft: null,
      image_url: imgUrl,
      location: null,
    });
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

  const html = await fetchPage(url, 3000);
  const $ = cheerio.load(html);
  const results = scrapeListings($, usdToNok);
  console.log(`Yachtworld: ${results.length} annonser funnet`);
  return results;
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('This listing is no longer available') ||
        html.includes('listing has been removed') ||
        html.includes('sold')) return 'sold';
    return 'active';
  } catch (e) {
    return null;
  }
}

module.exports = { search, checkListing };
