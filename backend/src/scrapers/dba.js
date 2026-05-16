'use strict';
const axios = require('axios');
const cheerio = require('cheerio');

const DBA_BASE = 'https://www.dba.dk';
const DBA_SEARCH = 'https://www.dba.dk/biler-og-transport/baade-og-sejlsport/sejlbaade/';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'da-DK,da;q=0.9',
};

const FALLBACK_DKK_TO_NOK = 0.148;

function buildUrl({ boatType, brand, yearMin, priceMinDKK, priceMaxDKK }) {
  const searchText = [boatType, brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ searchtext: searchText });
  if (yearMin)     params.append('minyear', yearMin);
  if (priceMinDKK) params.append('pricefrom', priceMinDKK);
  if (priceMaxDKK) params.append('priceto', priceMaxDKK);
  return `${DBA_SEARCH}?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function parseLength(str) {
  if (!str) return null;
  // Støtter "12,5 m", "12.5m", "41 fod"
  const mMatch = str.match(/([\d.,]+)\s*m/i);
  if (mMatch) {
    const m = parseFloat(mMatch[1].replace(',', '.'));
    return parseFloat((m / 0.3048).toFixed(1));
  }
  const ftMatch = str.match(/([\d.,]+)\s*f(o[dt])?/i);
  if (ftMatch) return parseFloat(ftMatch[1].replace(',', '.'));
  return null;
}

function scrapeListings($, dkkToNok) {
  const results = [];

  // DBA bruker .listingLink og .dbaListing som klasser
  $('[class*="listing"], article[data-listingid], .dbaListing, [data-adid]').each((_, el) => {
    const $el = $(el);

    const id =
      $el.attr('data-listingid') ||
      $el.attr('data-adid') ||
      $el.find('[data-adid]').attr('data-adid') ||
      '';

    if (!id) return;

    const title =
      $el.find('h2, h3, .listing-title, [class*="title"]').first().text().trim() || '';

    const href =
      $el.find('a').first().attr('href') || '';

    const url = href.startsWith('http') ? href : `${DBA_BASE}${href}`;

    const priceText = $el.find('[class*="price"], .price').first().text().trim();
    const priceDKK = parsePrice(priceText);
    const priceNok = priceDKK ? Math.round(priceDKK * dkkToNok) : null;

    const imgUrl =
      $el.find('img').first().attr('src') ||
      $el.find('img').first().attr('data-src') ||
      null;

    // Hent parametere fra listeelementer
    let year = null, lengthFt = null;
    $el.find('li, [class*="param"], [class*="detail"]').each((_, li) => {
      const text = $(li).text().trim();
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && !year) year = parseInt(yearMatch[0]);
      const len = parseLength(text);
      if (len && !lengthFt) lengthFt = len;
    });

    if (!id || !title) return;

    results.push({
      source: 'dba',
      external_id: String(id),
      url,
      title,
      brand: null,
      boat_type: null,
      price_nok: priceNok,
      price_original: priceDKK,
      currency: 'DKK',
      year,
      length_ft: lengthFt,
      image_url: imgUrl,
      location: null,
    });
  });

  return results;
}

async function search(params, rates) {
  const dkkToNok = rates?.DKK ?? FALLBACK_DKK_TO_NOK;
  const nokToDkk = 1 / dkkToNok;

  const priceMinDKK = params.priceMin ? Math.round(params.priceMin * nokToDkk) : null;
  const priceMaxDKK = params.priceMax ? Math.round(params.priceMax * nokToDkk) : null;

  const url = buildUrl({ ...params, priceMinDKK, priceMaxDKK });

  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results = scrapeListings($, dkkToNok);
    console.log(`DBA: fant ${results.length} annonser`);
    return results;
  } catch (err) {
    console.warn('DBA søk feilet:', err.response?.status, err.message);
    return [];
  }
}

async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, {
      headers: HEADERS,
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const pageText = $('body').text();
    if (
      pageText.includes('Annoncen er solgt') ||
      pageText.includes('Annoncen er slettet') ||
      pageText.includes('ikke længere tilgængelig')
    ) {
      return 'sold';
    }
    if (res.status === 404) return 'removed';
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    console.warn(`DBA checkListing feilet:`, err.message);
    return null;
  }
}

module.exports = { search, checkListing };
