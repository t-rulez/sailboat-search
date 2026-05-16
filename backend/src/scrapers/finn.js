'use strict';
const cheerio = require('cheerio');
const { interceptApiResponse, fetchPage } = require('./browser');

const FINN_SEARCH = 'https://www.finn.no/boat/used/search';

function buildUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
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

function parseDoc(doc, usdToNok) {
  const price = doc.price?.amount ?? doc.price ?? null;
  const priceVal = typeof price === 'object' ? price?.amount : price;
  return {
    source: 'finn',
    external_id: String(doc.finnkode || doc.id || ''),
    url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${doc.finnkode}`,
    title: doc.heading || doc.main_search_heading || 'Ukjent',
    brand: doc.make || doc.brand || null,
    boat_type: 'katamaran',
    price_nok: priceVal ? Math.round(priceVal) : null,
    price_original: priceVal ? Math.round(priceVal) : null,
    currency: 'NOK',
    year: doc.year || doc.model_year || null,
    length_ft: doc.boat_length ? parseFloat(doc.boat_length) : null,
    image_url: doc.main_search_image?.url || doc.image?.url || null,
    location: doc.location || null,
  };
}

function extractFromHtml(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Prøv alle script-tagger for JSON-data
  $('script').each((_, el) => {
    const text = $(el).text().trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return;
    try {
      const json = JSON.parse(text);
      const docs =
        json?.docs ||
        json?.response?.docs ||
        json?.props?.pageProps?.search?.docs ||
        json?.data?.docs ||
        [];
      if (docs.length > 0) {
        docs.forEach((doc) => {
          const item = parseDoc(doc);
          if (item.external_id) results.push(item);
        });
      }
    } catch (e) {}
  });

  return results;
}

async function search(params) {
  const url = buildUrl(params);
  console.log('Finn URL:', url);

  // Metode 1: Intercept det interne API-kallet Finn.no gjør
  try {
    const captured = await interceptApiResponse(url, {
      interceptPatterns: [
        'search-qf',
        '/api/search',
        'finn.no/api',
        'searchkey=BOAT_USED',
      ],
      waitMs: 5000,
    });

    for (const { data } of captured) {
      const docs = data?.docs || data?.response?.docs || data?.data?.docs || [];
      if (docs.length > 0) {
        console.log(`Finn: ${docs.length} via API-intercept`);
        return docs.map(parseDoc).filter((d) => d.external_id);
      }
    }
  } catch (e) {
    console.warn('Finn intercept feilet:', e.message);
  }

  // Metode 2: Parse HTML
  try {
    const html = await fetchPage(url, 4000);
    const results = extractFromHtml(html);
    if (results.length > 0) {
      console.log(`Finn: ${results.length} via HTML`);
      return results;
    }
    // Debug: logg hva slags HTML vi fikk
    const snippet = html.substring(0, 500).replace(/\s+/g, ' ');
    console.warn('Finn: ingen data funnet. HTML-start:', snippet);
  } catch (e) {
    console.warn('Finn HTML feilet:', e.message);
  }

  return [];
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('Denne annonsen er solgt') || html.includes('"sold":true')) return 'sold';
    if (html.includes('Finner ikke siden')) return 'removed';
    return 'active';
  } catch (e) { return null; }
}

module.exports = { search, checkListing };
