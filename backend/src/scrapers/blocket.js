'use strict';
const cheerio = require('cheerio');
const { fetchPage } = require('./browser');

const BLOCKET_SEARCH = 'https://www.blocket.se/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar';
const BLOCKET_BASE = 'https://www.blocket.se';
const FALLBACK_SEK_TO_NOK = 0.098;

function buildUrl({ boatType, brand, yearMin, priceMinSEK, priceMaxSEK }) {
  const q = [boatType, brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q });
  if (yearMin)     params.append('year_from', yearMin);
  if (priceMinSEK) params.append('price_from', priceMinSEK);
  if (priceMaxSEK) params.append('price_to', priceMaxSEK);
  return `${BLOCKET_SEARCH}?${params}`;
}

function parsePrice(str) {
  if (!str) return null;
  const num = parseInt(str.replace(/[^\d]/g, ''), 10);
  return isNaN(num) ? null : num;
}

function scrapeListings($, sekToNok) {
  const results = [];

  // Prøv __NEXT_DATA__
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const ads =
        json?.props?.pageProps?.initialState?.searchPage?.ads ||
        json?.props?.pageProps?.ads ||
        json?.props?.pageProps?.searchResult?.ads ||
        json?.props?.pageProps?.listings ||
        [];
      if (ads.length > 0) {
        console.log(`Blocket: ${ads.length} via __NEXT_DATA__`);
        ads.forEach((ad) => {
          const priceSEK = ad.price?.value ?? ad.list_price?.value ?? null;
          const id = String(ad.ad_id || ad.id || '');
          if (!id) return;
          results.push({
            source: 'blocket',
            external_id: id,
            url: ad.share_url || `${BLOCKET_BASE}/annons/${id}`,
            title: ad.subject || ad.heading || 'Ukjent',
            brand: null,
            boat_type: null,
            price_nok: priceSEK ? Math.round(priceSEK * sekToNok) : null,
            price_original: priceSEK ? Math.round(priceSEK) : null,
            currency: 'SEK',
            year: ad.year || null,
            length_ft: null,
            image_url: ad.images?.[0]?.url || null,
            location: ad.location?.name || null,
          });
        });
        return results;
      }
    } catch (e) {
      console.warn('Blocket __NEXT_DATA__ feilet:', e.message);
    }
  }

  // Fallback HTML
  $('article, [data-testid*="listing"], [class*="ListItem"], [class*="styled__Wrapper"]').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('data-ad-id') || $el.attr('data-id') || $el.find('[data-ad-id]').attr('data-ad-id') || '';
    if (!id) return;
    const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
    const href = $el.find('a').first().attr('href') || '';
    const url = href.startsWith('http') ? href : `${BLOCKET_BASE}${href}`;
    const priceSEK = parsePrice($el.find('[class*="price"]').first().text());
    const imgUrl = $el.find('img').first().attr('src') || null;
    if (!id || !title) return;
    results.push({
      source: 'blocket',
      external_id: id,
      url,
      title,
      brand: null,
      boat_type: null,
      price_nok: priceSEK ? Math.round(priceSEK * sekToNok) : null,
      price_original: priceSEK,
      currency: 'SEK',
      year: null,
      length_ft: null,
      image_url: imgUrl,
      location: null,
    });
  });

  return results;
}

async function search(params, rates) {
  const sekToNok = rates?.SEK ?? FALLBACK_SEK_TO_NOK;
  const nokToSek = 1 / sekToNok;
  const priceMinSEK = params.priceMin ? Math.round(params.priceMin * nokToSek) : null;
  const priceMaxSEK = params.priceMax ? Math.round(params.priceMax * nokToSek) : null;

  const url = buildUrl({ ...params, priceMinSEK, priceMaxSEK });
  console.log('Blocket URL:', url);

  const html = await fetchPage(url, 2500);
  const $ = cheerio.load(html);
  const results = scrapeListings($, sekToNok);
  console.log(`Blocket: ${results.length} annonser funnet`);
  return results;
}

async function checkListing(listing) {
  try {
    const html = await fetchPage(listing.url, 1000);
    if (html.includes('Annonsen är såld') || html.includes('Annonsen är borttagen')) return 'sold';
    return 'active';
  } catch (e) {
    return null;
  }
}

module.exports = { search, checkListing };
