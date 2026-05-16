import { useState, useCallback } from 'react';
import { getExchangeRates, convertToNOK } from '../utils/currency';

// Finn.no sitt åpne søke-API
// Dokumentasjon: https://finnno.github.io/
const FINN_API_BASE = 'https://www.finn.no/api/search-qf';

// CORS proxy – nødvendig siden Finn blokkerer direkte nettleser-kall
// Vi bruker allorigins.win (gratis, åpen)
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

function buildFinnApiUrl({ boatType, brand, yearMin, priceMin, priceMax, sizeMinFt, sizeMaxFt }) {
  // Kombiner type og merke til én søkestreng, f.eks. "katamaran Lagoon"
  const query = [boatType, brand].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    searchkey: 'BOAT_USED',
    q: query,
    price_from: priceMin,
    price_to: priceMax,
    year_from: yearMin,
    boat_length_from: sizeMinFt,
    boat_length_to: sizeMaxFt,
    sort: '1', // Nyeste først
    rows: '48',
    page: '1',
  });

  return `${FINN_API_BASE}?${params}`;
}

function parseFinnResults(data, rates) {
  try {
    const docs = data?.docs || data?.response?.docs || [];
    return docs.map((doc) => {
      const priceRaw = doc.price?.amount || doc.price || null;
      const lengthRaw = doc.boat_length || doc.length || null;

      return {
        id: doc.finnkode || doc.id || Math.random().toString(),
        source: 'finn',
        title: doc.heading || doc.main_search_heading || 'Ukjent tittel',
        price_nok: priceRaw,
        price_original: priceRaw,
        currency: 'NOK',
        year: doc.year || doc.model_year || null,
        length_ft: lengthRaw,
        length_m: lengthRaw ? (lengthRaw * 0.3048).toFixed(1) : null,
        image: doc.main_search_image?.url || doc.image?.url || doc.images?.[0]?.url || null,
        location: doc.location || doc.trade_type || '',
        url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${doc.finnkode}`,
        boat_type: doc.boat_type_name || '',
        brand: doc.make || doc.brand || doc.manufacturer || '',
        description: doc.ad_text || '',
      };
    });
  } catch (e) {
    console.error('Feil ved parsing av Finn-resultater:', e);
    return [];
  }
}

// Prøver direktekall først, faller tilbake til CORS proxy
async function fetchFinnData(url) {
  // Prøv direkte
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.docs || data?.response?.docs) return data;
    }
  } catch (e) {
    // Falt gjennom til proxy
  }

  // Prøv via CORS proxy
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  const proxyRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!proxyRes.ok) throw new Error(`Proxy feilet: ${proxyRes.status}`);
  const proxyData = await proxyRes.json();
  const contents = proxyData?.contents;
  if (!contents) throw new Error('Tomt svar fra proxy');
  return JSON.parse(contents);
}

export function useBoatSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rates, setRates] = useState(null);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const search = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    setLastSearchParams(params);

    try {
      // Hent valutakurser
      const exchangeRates = await getExchangeRates();
      setRates(exchangeRates);

      const finnUrl = buildFinnApiUrl({
        boatType: params.boatType,
        brand: params.brand,
        yearMin: params.yearMin,
        priceMin: params.priceMin,
        priceMax: params.priceMax,
        sizeMinFt: params.sizeMin,
        sizeMaxFt: params.sizeMax,
      });

      let finnResults = [];
      try {
        const data = await fetchFinnData(finnUrl);
        finnResults = parseFinnResults(data, exchangeRates);
        setTotalCount(data?.metadata?.result_size?.match_count || data?.response?.numFound || finnResults.length);
      } catch (finnErr) {
        console.error('Finn-søk feilet:', finnErr);
        // Ikke kast feil – vis heller tomme resultater med melding
        setError(`Finn.no-søket feilet: ${finnErr.message}. Bruk lenkene under for å søke manuelt.`);
      }

      setResults(finnResults);
    } catch (err) {
      setError(`Søket feilet: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, rates, search, lastSearchParams, totalCount };
}
