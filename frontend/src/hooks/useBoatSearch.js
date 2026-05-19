import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Slå sammen Finn-resultater med favorittinfo fra DB
function mergeFavorites(listings, favoriteIds) {
  return listings.map(l => ({
    ...l,
    is_favorite: favoriteIds.has(`${l.source}:${l.external_id}`),
  }));
}

// Send resultater til backend for lagring
async function importToBackend(listings) {
  if (!listings.length) return {};
  try {
    console.log('Importerer', listings.length, 'listings til backend');
    const res = await fetch(`${API_URL}/api/search/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
    console.log('Import respons status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Import data keys:', Object.keys(data));
      console.log('dates type:', typeof data.dates, 'entries:', data.dates ? Object.keys(data.dates).length : 'null');
      return data.dates || {};
    } else {
      console.warn('Import feilet med status:', res.status);
    }
  } catch (e) {
    console.warn('Import til backend feilet:', e.message);
  }
  return {};
}

export function useBoatSearch() {
  const [results, setResults]                   = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState(null);
  const [totalCount, setTotalCount]             = useState(0);
  const [lastSearchParams, setLastSearchParams] = useState(null);

  const search = useCallback(async (params, source = 'all') => {
    setLoading(true);
    setError(null);
    setLastSearchParams(params);

    try {
      // Hent Finn-resultater og favorittliste parallelt
      const query = new URLSearchParams({
        brand:    params.brand    || '',
        yearMin:  params.yearMin  || '',
        priceMin: params.priceMin || '',
        priceMax: params.priceMax || '',
        sizeMin:  params.sizeMin  || '',
        sizeMax:  params.sizeMax  || '',
      });

      const shouldFetch = (src) => source === 'all' || source === src;

      const [finnRes, blocketRes, boat24Res, favRes] = await Promise.all([
        shouldFetch('finn')
          ? fetch(`${API_URL}/api/finn?${query}`, { signal: AbortSignal.timeout(30000) })
          : Promise.resolve(null),
        shouldFetch('blocket')
          ? fetch(`${API_URL}/api/blocket?${query}`, { signal: AbortSignal.timeout(30000) }).catch(() => null)
          : Promise.resolve(null),
        shouldFetch('boat24')
          ? fetch(`https://boat24.truls.workers.dev/?${query}`, { signal: AbortSignal.timeout(30000) }).catch(() => null)
          : Promise.resolve(null),
        fetch(`${API_URL}/api/favorites`).catch(() => null),
      ]);

      let finnDocs = [];
      if (finnRes?.ok) {
        const finnData = await finnRes.json();
        finnDocs = finnData?.docs || [];
      } else if (finnRes && !finnRes.ok) {
        throw new Error(`Finn svarte med ${finnRes.status}`);
      }

      let blocketDocs = [];
      if (blocketRes?.ok) {
        const blocketData = await blocketRes.json();
        blocketDocs = blocketData?.docs || [];
      }

      let boat24Docs = [];
      if (boat24Res?.ok) {
        const boat24Data = await boat24Res.json();
        boat24Docs = boat24Data?.docs || [];
      }

      const listings = [...finnDocs, ...blocketDocs, ...boat24Docs];

      // Bygg opp et sett med favoritt-nøkler
      let favoriteIds = new Set();
      if (favRes?.ok) {
        const favData = await favRes.json();
        favoriteIds = new Set(
          (favData.listings || []).map(f => `${f.source}:${f.external_id}`)
        );
      }

      const merged = mergeFavorites(listings, favoriteIds);
      setResults(merged);
      setTotalCount(merged.length);

      // Lagre i DB og hent first_seen_at per annonse
      importToBackend(listings).then(dates => {
        const today = new Date().toISOString();
        console.log('Dates fra DB:', Object.keys(dates).length, 'entries');
        console.log('Første 3:', Object.entries(dates).slice(0, 3));
        setResults(prev => prev.map(l => ({
          ...l,
          first_seen_at: dates[`${l.source}:${l.external_id}`] || l.first_seen_at || today,
        })));
      });

    } catch (err) {
      setError(`Søket feilet: ${err.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Oppdater favoritt-status på ett resultat uten nytt søk
  const updateFavorite = useCallback((source, external_id, isFavorite) => {
    setResults(prev => prev.map(r =>
      r.source === source && r.external_id === external_id
        ? { ...r, is_favorite: isFavorite }
        : r
    ));
  }, []);

  return { results, loading, error, search, lastSearchParams, totalCount, updateFavorite };
}
