'use strict';
const axios = require('axios');
const cheerio = require('cheerio');

const DBA_BASE = 'https://www.dba.dk';
// Oppdatert URL-struktur for DBA
const DBA_SEARCH = 'https://www.dba.dk/biler-og-transport/baade-og-sejlsport/sejlbaade/';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
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

  // Prøv __NEXT_DATA__ eller window.__data__ først
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const ads =
        json?.props?.pageProps?.listings ||
        json?.props?.pageProps?.searchResult?.listings ||
        json?.props?.pageProps?.ads ||
        [];
      if (ads.length > 0) {
        console.log(`DBA: fant ${ads.length} via __NEXT_DATA__`);
        ads.forEach((ad) => {
          const priceDKK = ad.price?.price ?? ad.price ?? null;
          const id = String(ad.id || ad.adId || '');
          if (!id) return;
          results.push({
            source: 'dba',
            external_id: id,
            url: ad.adUrl ? `${DBA_BASE}${ad.adUrl}` : `${DBA_BASE}/annonce/${id}/`,
            title: ad.header || ad.headline || ad.title || 'Ukjent',
            brand: null,
            boat_type: null,
            price_nok: priceDKK ? Math.round(priceDKK * dkkToNok) : null,
            price_original: priceDKK,
            currency: 'DKK',
            year: ad.modelYear || null,
            length_ft: null,
            image_url: ad.images?.[0]?.url || ad.thumbnailUrl || null,
            location: ad.location?.name || null,
          });
        });
        return results;
      }
    } catch (e) {
      console.warn('DBA __NEXT_DATA__ feilet:', e.message);
    }
  }

  // Fallback: klassisk HTML-scraping
  $('[class*="listingCard"], [class*="ListingCard"], [data-listingid], article').each((_, el) => {
    const $el = $(el);
    const id =
      $el.attr('data-listingid') ||
      $el.attr('data-ad-id') ||
      $el.attr('id')?.replace(/\D/g, '') ||
      '';
    if (!id || id.length < 3) return;

    const title = $el.find('h2, h3, [class*="title"], [class*="Title"]').first().text().trim();
    const href = $el.find('a').first().attr('href') || '';
    const url = href.startsWith('http') ? href : `${DBA_BASE}${href}`;
    const priceText = $el.find('[class*="price"], [class*="Price"]').first().text().trim();
    const priceDKK = parsePrice(priceText);
    const imgUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;

    let year = null, lengthFt = null;
    $el.find('li, [class*="param"], [class*="attr"]').each((_, li) => {
      const text = $(li).text().trim();
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && !year) year = parseInt(yearMatch[0]);
      const len = parseLength(text);
      if (len && !lengthFt) lengthFt = len;
    });

    if (!id || !title) return;
    results.push({
      source: 'dba',
      external_id: id,
      url,
      title,
      brand: null,
      boat_type: null,
      price_nok: priceDKK ? Math.round(priceDKK * dkkToNok) : null,
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
  console.log('DBA URL:', url);

  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const results = scrapeListings($, dkkToNok);
    console.log(`DBA: ${results.length} annonser funnet`);
    return results;
  } catch (err) {
    console.warn('DBA søk feilet:', err.response?.status, err.message);
    return [];
  }
}

async function checkListing(listing) {
  try {
    const res = await axios.get(listing.url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(res.data);
    const text = $('body').text();
    if (
      text.includes('Annoncen er solgt') ||
      text.includes('Annoncen er slettet') ||
      text.includes('ikke længere tilgængelig')
    ) return 'sold';
    if (res.status === 404) return 'removed';
    return 'active';
  } catch (err) {
    if (err.response?.status === 404) return 'removed';
    return null;
  }
}

module.exports = { search, checkListing };
