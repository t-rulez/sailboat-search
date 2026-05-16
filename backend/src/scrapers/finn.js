'use strict';
const cheerio = require('cheerio');
const { fetchPage } = require('./browser');

const FINN_SEARCH = 'https://www.finn.no/boat/used/search';

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
  });
  return `${FINN_SEARCH}?${params}`;
}

function scrapeListings($) {
  const results = [];

  // Prøv JSON-data i script-tagger først
  $('script[type="application/json"], script#__NEXT_DATA__').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const docs =
        json?.docs ||
        json?.props?.pageProps?.search?.docs ||
        json?.props?.pageProps?.initialProps?.docs ||
        [];
      if (docs.length > 0) {
        docs.forEach((doc) => {
          const price = doc.price?.amount ?? doc.price ?? null;
          const id = String(doc.finnkode || doc.id || '');
          if (!id) return;
          results.push({
            source: 'finn',
            external_id: id,
            url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${id}`,
            title: doc.heading || doc.main_search_heading || 'Ukjent',
            brand: doc.make || doc.brand || null,
            boat_type: doc.boat_type_name || null,
            price_nok: price ? Math.round(price) : null,
            price_original: price ? Math.round(price) : null,
            currency: 'NOK',
            year: doc.year || doc.model_year || null,
            length_ft: doc.boat_length ? parseFloat(doc.boat_length) : null,
            image_url: doc.main_search_image?.url || doc.image?.url || null,
            location: doc.location || null,
          });
        });
      }
    } catch (e) { /* ikke JSON */ }
  });

  if (results.length > 0) return results;

  // Fallback: HTML-scraping
  $('article[data-testid], [class*="sf-search-ad"], [class*="AdCard"]').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a[href*="finn.no/boat"], a[href*="/boat/used/ad"]').first().attr('href') || '';
    const idMatch = href.match(/finnkode=(\d+)/) || href.match(/\/ad\.html\?finnkode=(\d+)/);
    const id = idMatch?.[1] || '';
    if (!id) return;

    const title = $el.find('h2, h3').first().text().trim();
    const priceText = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || null;
    const imgUrl = $el.find('img').first().attr('src') || null;

    if (!id || !title) return;
    results.push({
      source: 'finn',
      external_id: id,
      url: href.startsWith('http') ? href : `https://www.finn.no${href}`,
      title,
      brand: null,
      boat_type: null,
      price_nok: price,
      price_original: price,
      currency: 'NOK',
      year: null,
      length_ft: null,
      image_url: imgUrl,
      location: null,
    });
  });

  return results;
}

async function search(params) {
  const url = buildUrl(params);
  console.log('Finn URL:', url);
  const html = await fetchPage(url, 2500);
  const $ = cheerio.load(html);
  const results = scrapeListings($);
  console.log(`Finn: ${results.length} annonser funnet`);
  return results;
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (
      html.includes('Denne annonsen er solgt') ||
      html.includes('Annonsen er slettet') ||
      html.includes('"sold":true')
    ) return 'sold';
    if (html.includes('Finner ikke siden')) return 'removed';
    return 'active';
  } catch (e) {
    return null;
  }
}

module.exports = { search, checkListing };
