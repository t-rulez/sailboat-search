import { useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useFavorites() {
  const toggle = useCallback(async (listing) => {
    const method = listing.is_favorite ? 'DELETE' : 'POST';
    try {
      const res = await fetch(`${API_URL}/api/favorites/${listing.id}`, { method });
      if (!res.ok) throw new Error(`Feil: ${res.status}`);
      return !listing.is_favorite;
    } catch (err) {
      console.error('Favoritt-feil:', err);
      return listing.is_favorite; // rollback
    }
  }, []);

  return { toggle };
}
