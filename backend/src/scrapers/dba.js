'use strict';
const cheerio = require('cheerio');
const { fetchPage } = require('./browser');

const DBA_BASE = 'https://www.dba.dk';
const DBA_SEARCH = 'https://www.dba.dk/biler-og-transport/baade-og-sejlsport/sejlbaade/';
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
  if (mMatch) return parseFloat((parseFloat(mMatch[1].replace(',', '.')) / 0.3048).toFixed(1));
  const ftMatch = str.match(/([\d.,]+)\s*f(o[dt])?/i);
  if (ftMatch) return parseFloat(ftMatch[1].replace(',', '.'));
  return null;
}

function scrapeListings($, dkkToNok) {
  const results = [];

  // Prøv __NEXT_DATA__
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const ads =
        json?.props?.pageProps?.listings ||
        json?.props?.pageProps?.searchResult?.listings ||
        json?.props?.pageProps?.ads ||
        json?.props?.pageProps?.data?.listings ||
        [];
      if (ads.length > 0) {
        console.log(`DBA: ${ads.length} via __NEXT_DATA__`);
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

  // Fallback HTML
  $('[class*="listingCard"], [class*="ListingCard"], [data-listingid], [class*="Listing"]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-listingid') || $el.attr('data-ad-id') || '';
    if (!id || id.length < 3) return;
    const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
    const href = $el.find('a').first().attr('href') || '';
    const url = href.startsWith('http') ? href : `${DBA_BASE}${href}`;
    const priceDKK = parsePrice($el.find('[class*="price"]').first().text());
    const imgUrl = $el.find('img').first().attr('src') || null;
    let year = null, lengthFt = null;
    $el.find('li, [class*="param"]').each((_, li) => {
      const text = $(li).text().trim();
      const y = text.match(/\b(19|20)\d{2}\b/);
      if (y && !year) year = parseInt(y[0]);
      const l = parseLength(text);
      if (l && !lengthFt) lengthFt = l;
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

  const html = await fetchPage(url, 2500);
  const $ = cheerio.load(html);
  const results = scrapeListings($, dkkToNok);
  console.log(`DBA: ${results.length} annonser funnet`);
  return results;
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    const $ = cheerio.load(html);
    const text = $('body').text();
    if (text.includes('Annoncen er solgt') || text.includes('ikke længere tilgængelig')) return 'sold';
    return 'active';
  } catch (e) {
    return null;
  }
}

module.exports = { search, checkListing };
