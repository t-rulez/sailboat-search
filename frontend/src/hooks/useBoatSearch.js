import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useBoatSearch() {
  const [results, setResults]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [totalCount, setTotalCount]         = useState(0);

  const search = useCallback(async (params, extra = {}) => {
    setLoading(true);
    setError(null);
    setLastSearchParams(params);

    try {
      const query = new URLSearchParams({
        boatType:  params.boatType  || '',
        brand:     params.brand     || '',
        yearMin:   params.yearMin   || '',
        priceMin:  params.priceMin  || '',
        priceMax:  params.priceMax  || '',
        sizeMin:   params.sizeMin   || '',
        sizeMax:   params.sizeMax   || '',
        sort:      extra.sort       || 'price_nok',
        dir:       extra.dir        || 'asc',
        status:    extra.status     || 'active',
        source:    extra.source     || 'all',
        favoritesOnly: extra.favoritesOnly ? 'true' : 'false',
      });

      const res = await fetch(`${API_URL}/api/search?${query}`);
      if (!res.ok) throw new Error(`Server svarte med ${res.status}`);

      const data = await res.json();
      setResults(data.listings || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search, lastSearchParams, totalCount };
}
