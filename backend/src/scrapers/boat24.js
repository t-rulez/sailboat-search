'use strict';
const cheerio = require('cheerio');
const { fetchPage } = require('./browser');

// Boat24 – Norge, Sverige, Danmark – seilbåter
// Priser i EUR
const BASE_URL = 'https://www.boat24.com/en/sailboats/';
const FALLBACK_EUR_TO_NOK = 11.8;

function buildUrl({ brand, yearMin, priceMinEUR, priceMaxEUR, sizeMin, sizeMax }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q });
  // Boat24 bruker country[] array-format
  ['NO', 'SE', 'DK'].forEach((c) => params.append('country[]', c));
  if (yearMin)     params.set('year_from', yearMin);
  if (priceMinEUR) params.set('price_from', priceMinEUR);
  if (priceMaxEUR) params.set('price_to', priceMaxEUR);
  if (sizeMin)     params.set('length_from', Math.round(sizeMin * 0.3048)); // fot → meter
  if (sizeMax)     params.set('length_to', Math.round(sizeMax * 0.3048));
  return `${BASE_URL}?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseLength(str) {
  if (!str) return null;
  const mMatch = str.match(/([\d.,]+)\s*m/i);
  if (mMatch) return parseFloat((parseFloat(mMatch[1].replace(',', '.')) / 0.3048).toFixed(1));
  const ftMatch = str.match(/([\d.,]+)\s*ft/i);
  if (ftMatch) return parseFloat(ftMatch[1]);
  return null;
}

function scrapeListings($, eurToNok) {
  const results = [];

  // Boat24 er en React/Next.js app – prøv JSON i script-tagger
  $('script').each((_, el) => {
    const text = $(el).text();
    if (!text.includes('"boats"') && !text.includes('"listings"') && !text.includes('"results"')) return;
    try {
      const json = JSON.parse(text);
      const items =
        json?.props?.pageProps?.boats ||
        json?.props?.pageProps?.listings ||
        json?.props?.pageProps?.searchResult?.boats ||
        json?.boats ||
        json?.results ||
        [];
      if (!items.length) return;

      console.log(`Boat24: ${items.length} via JSON`);
      items.forEach((item) => {
        const priceEUR = item.price?.amount ?? item.price ?? null;
        const id = String(item.id || item.boat_id || '');
        if (!id) return;
        const slug = item.slug || item.url_key || id;
        results.push({
          source: 'boat24',
          external_id: id,
          url: `https://www.boat24.com/en/sailboats/${slug}/`,
          title: [item.manufacturer, item.model, item.year].filter(Boolean).join(' ') || item.title || 'Ukjent',
          brand: item.manufacturer || item.make || null,
          boat_type: 'katamaran',
          price_nok: priceEUR ? Math.round(priceEUR * eurToNok) : null,
          price_original: priceEUR ? Math.round(priceEUR) : null,
          currency: 'EUR',
          year: item.year || null,
          length_ft: item.length ? parseFloat((item.length / 0.3048).toFixed(1)) : null,
          image_url: item.images?.[0]?.url || item.main_image || null,
          location: item.country || item.location || null,
        });
      });
    } catch (e) { /* ikke JSON */ }
  });

  if (results.length > 0) return results;

  // Fallback: HTML-scraping
  $('[class*="boat-card"], [class*="BoatCard"], [class*="listing"], article').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a').first().attr('href') || '';
    if (!href.includes('sailboat') && !href.includes('boat')) return;

    const idMatch = href.match(/\/(\d+)\/?$/) || href.match(/boat-(\d+)/);
    const id = idMatch?.[1] || $el.attr('data-id') || '';
    if (!id) return;

    const title = $el.find('h2, h3, [class*="title"], [class*="name"]').first().text().trim();
    const priceText = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
    const priceEUR = parsePrice(priceText);
    const imgUrl = $el.find('img').first().attr('src') || null;
    const lengthText = $el.find('[class*="length"], [class*="loa"]').first().text().trim();
    const lengthFt = parseLength(lengthText);
    const yearText = $el.find('[class*="year"]').first().text().match(/\b(19|20)\d{2}\b/)?.[0];

    if (!id || !title) return;
    results.push({
      source: 'boat24',
      external_id: id,
      url: href.startsWith('http') ? href : `https://www.boat24.com${href}`,
      title,
      brand: null,
      boat_type: 'katamaran',
      price_nok: priceEUR ? Math.round(priceEUR * eurToNok) : null,
      price_original: priceEUR,
      currency: 'EUR',
      year: yearText ? parseInt(yearText) : null,
      length_ft: lengthFt,
      image_url: imgUrl,
      location: null,
    });
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

  const html = await fetchPage(url, 3000);
  const $ = cheerio.load(html);
  const results = scrapeListings($, eurToNok);
  console.log(`Boat24: ${results.length} annonser funnet`);
  return results;
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('no longer available') || html.includes('sold') || html.includes('404')) return 'sold';
    return 'active';
  } catch (e) {
    return null;
  }
}

module.exports = { search, checkListing };
