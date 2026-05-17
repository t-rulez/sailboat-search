import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Finn.no søke-API – kalles direkte fra nettleseren (ingen CORS-blokkering)
const FINN_API = 'https://www.finn.no/api/search-qf';

function buildFinnUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    searchkey: 'BOAT_USED',
    q,
    price_from:        priceMin  || '',
    price_to:          priceMax  || '',
    year_from:         yearMin   || '',
    boat_length_from:  sizeMin   || '',
    boat_length_to:    sizeMax   || '',
    sort: '1',
    rows: '48',
    page: '1',
  });
  return `${FINN_API}?${params}`;
}

function parseFinnDoc(doc) {
  const priceRaw = doc.price?.amount ?? doc.price ?? null;
  const price = typeof priceRaw === 'object' ? priceRaw?.amount : priceRaw;
  const lengthRaw = doc.boat_length ?? doc.length ?? null;
  return {
    source: 'finn',
    external_id: String(doc.finnkode || doc.id || ''),
    url: doc.canonical_url || `https://www.finn.no/boat/used/ad.html?finnkode=${doc.finnkode}`,
    title: doc.heading || doc.main_search_heading || 'Ukjent',
    brand: doc.make || doc.brand || null,
    boat_type: 'katamaran',
    price_nok: price ? Math.round(price) : null,
    price_original: price ? Math.round(price) : null,
    currency: 'NOK',
    year: doc.year || doc.model_year || null,
    length_ft: lengthRaw ? parseFloat(lengthRaw) : null,
    image_url: doc.main_search_image?.url || doc.image?.url || null,
    location: doc.location || null,
    status: 'active',
  };
}

// Send resultater til backend for lagring
async function importToBackend(listings) {
  if (!listings.length) return;
  try {
    await fetch(`${API_URL}/api/search/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
  } catch (e) {
    console.warn('Import til backend feilet:', e.message);
  }
}

export function useBoatSearch() {
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [lastSearchParams, setLastSearchParams] = useState(null);

  const search = useCallback(async (params, extra = {}) => {
    setLoading(true);
    setError(null);
    setLastSearchParams(params);

    // Har vi filtre som ikke Finn kan håndtere, hent fra DB i stedet
    const useDb = extra.favoritesOnly || extra.source !== 'all' && extra.source !== 'finn';

    if (useDb) {
      try {
        const query = new URLSearchParams({
          brand:    params.brand    || '',
          yearMin:  params.yearMin  || '',
          priceMin: params.priceMin || '',
          priceMax: params.priceMax || '',
          sizeMin:  params.sizeMin  || '',
          sizeMax:  params.sizeMax  || '',
          sort:   extra.sort   || 'price_nok',
          dir:    extra.dir    || 'asc',
          status: extra.status || 'active',
          source: extra.source || 'all',
          favoritesOnly: extra.favoritesOnly ? 'true' : 'false',
        });
        const res = await fetch(`${API_URL}/api/search?${query}`);
        if (!res.ok) throw new Error(`Server svarte ${res.status}`);
        const data = await res.json();
        setResults(data.listings || []);
        setTotalCount(data.count || 0);
      } catch (err) {
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Søk direkte mot Finn.no fra nettleseren
    try {
      const finnUrl = buildFinnUrl(params);
      const res = await fetch(finnUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`Finn.no svarte med ${res.status}`);

      const data = await res.json();
      const docs = data?.docs || data?.response?.docs || [];
      const listings = docs.map(parseFinnDoc).filter((d) => d.external_id);

      setResults(listings);
      setTotalCount(data?.metadata?.result_size?.match_count || listings.length);

      // Lagre i backend-DB i bakgrunnen
      importToBackend(listings);

    } catch (err) {
      setError(`Finn.no-søket feilet: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search, lastSearchParams, totalCount };
}
