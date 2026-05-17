import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [results, setResults]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [totalCount, setTotalCount]         = useState(0);
  const [lastSearchParams, setLastSearchParams] = useState(null);

  const search = useCallback(async (params, extra = {}) => {
    setLoading(true);
    setError(null);
    setLastSearchParams(params);

    // DB-søk for favoritter eller kilde-filter
    const useDb = extra.favoritesOnly || (extra.source && extra.source !== 'all' && extra.source !== 'finn');

    if (useDb) {
      try {
        const query = new URLSearchParams({
          brand:         params.brand    || '',
          yearMin:       params.yearMin  || '',
          priceMin:      params.priceMin || '',
          priceMax:      params.priceMax || '',
          sizeMin:       params.sizeMin  || '',
          sizeMax:       params.sizeMax  || '',
          sort:          extra.sort      || 'price_nok',
          dir:           extra.dir       || 'asc',
          status:        extra.status    || 'active',
          source:        extra.source    || 'all',
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

    // Finn-søk via Railway-proxy (unngår CORS)
    try {
      const query = new URLSearchParams({
        brand:    params.brand    || '',
        yearMin:  params.yearMin  || '',
        priceMin: params.priceMin || '',
        priceMax: params.priceMax || '',
        sizeMin:  params.sizeMin  || '',
        sizeMax:  params.sizeMax  || '',
      });

      const res = await fetch(`${API_URL}/api/finn?${query}`, {
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) throw new Error(`Proxy svarte med ${res.status}`);

      const data = await res.json();
      const docs = data?.docs || data?.response?.docs || [];
      const listings = docs.map(parseFinnDoc).filter((d) => d.external_id);

      setResults(listings);
      setTotalCount(data?.metadata?.result_size?.match_count || listings.length);

      // Lagre i DB i bakgrunnen
      importToBackend(listings);

    } catch (err) {
      setError(`Søket feilet: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search, lastSearchParams, totalCount };
}
