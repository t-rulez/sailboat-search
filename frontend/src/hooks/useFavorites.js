import { useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useFavorites() {
  const toggle = useCallback(async (listing) => {
    const { source, external_id, is_favorite } = listing;
    const method = is_favorite ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`${API_URL}/api/favorites/${source}/${external_id}`, { method });
      if (!res.ok) {
        const data = await res.json();
        // Annonsen er ikke i DB ennå – skjer hvis import ikke er ferdig
        if (res.status === 404) {
          console.warn('Annonse ikke i DB ennå, prøv igjen om et sekund');
        }
        throw new Error(data.error || `Feil: ${res.status}`);
      }
      return !is_favorite;
    } catch (err) {
      console.error('Favoritt-feil:', err.message);
      return is_favorite; // rollback
    }
  }, []);

  return { toggle };
}
