import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import SearchForm from './components/SearchForm';
import ExternalLinks from './components/ExternalLinks';
import ResultList from './components/ResultList';
import { useBoatSearch } from './hooks/useBoatSearch';
import { useFavorites } from './hooks/useFavorites';

const STORAGE_KEY = 'baatsok_last_search';

const DEFAULT_PARAMS = {
  brand: '',
  yearMin: 2020,
  priceMin: 3000000,
  priceMax: 6000000,
  sizeMin: 38,
  sizeMax: 42,
};

function loadSavedParams() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_PARAMS, ...JSON.parse(saved) } : DEFAULT_PARAMS;
  } catch {
    return DEFAULT_PARAMS;
  }
}

export default function App() {
  const { results, loading, error, search, totalCount } = useBoatSearch();
  const { toggle: toggleFav } = useFavorites();

  const [tab, setTab]         = useState('search'); // 'search' | 'favorites'
  const [hasSearched, setHasSearched] = useState(false);
  const [sortKey, setSortKey] = useState('price_nok');
  const [sortDir, setSortDir] = useState('asc');
  const [source, setSource]   = useState('all');
  const [status, setStatus]   = useState('active');
  const [searchParams, setSearchParams] = useState(loadSavedParams());

  // Favoritter hentes separat
  const [favorites, setFavorites]     = useState([]);
  const [favLoading, setFavLoading]   = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchFavorites = useCallback(async () => {
    setFavLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/favorites`);
      const data = await res.json();
      setFavorites(data.listings || []);
    } catch (e) {
      console.error('Henting av favoritter feilet:', e);
    } finally {
      setFavLoading(false);
    }
  }, [API_URL]);

  // Last favoritter ved oppstart – feil her skal ikke krasje appen
  useEffect(() => {
    fetchFavorites().catch(() => {});
  }, []);

  const handleSearch = useCallback((params) => {
    setSearchParams(params);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    setHasSearched(true);
    setTab('search');
    search(params, { sort: sortKey, dir: sortDir, source, status });
  }, [search, sortKey, sortDir, source, status]);

  // Re-søk når sortering/filtre endres
  const handleSortChange = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
    if (hasSearched) search(searchParams, { sort: key, dir, source, status });
  };

  const handleSourceChange = (s) => {
    setSource(s);
    if (hasSearched) search(searchParams, { sort: sortKey, dir: sortDir, source: s, status });
  };

  const handleStatusChange = (st) => {
    setStatus(st);
    if (hasSearched) search(searchParams, { sort: sortKey, dir: sortDir, source, status: st });
  };

  // Optimistisk favoritt-toggle
  const handleToggleFavorite = useCallback(async (boat) => {
    const newVal = await toggleFav(boat);
    // Oppdater i resultatlisten
    results.forEach((r) => { if (r.id === boat.id) r.is_favorite = newVal; });
    // Oppdater favoritter
    fetchFavorites();
  }, [toggleFav, results, fetchFavorites]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <p className="header-eyebrow">⚓ Katamaran</p>
        <h1 className="app-title">Katamaran langtur 2029</h1>
        <p className="app-subtitle">Søker i hele Norden</p>
      </header>

      {/* Infobanner */}
      <div className="source-info-banner">
        Viser katamaraner fra Finn.no, Blocket.se, Yachtworld og Boat24
      </div>

      {/* Tabs */}
      <div className="app-tabs">
        <button
          className={`app-tab ${tab === 'search' ? 'app-tab-active' : ''}`}
          onClick={() => setTab('search')}
        >
          Søk
        </button>
        <div className="tab-divider" />
        <button
          className={`app-tab ${tab === 'favorites' ? 'app-tab-active' : ''}`}
          onClick={() => { setTab('favorites'); fetchFavorites(); }}
        >
          <Heart size={14} />
          Favoritter
          {favorites.length > 0 && (
            <span className="fav-count">{favorites.length}</span>
          )}
        </button>
      </div>

      {/* Søk-fane */}
      {tab === 'search' && (
        <>
          <SearchForm
            onSearch={handleSearch}
            loading={loading}
            initialParams={searchParams}
          />

          {error && (
            <div className="error-banner">
              ⚠️ {error}
            </div>
          )}

          {hasSearched && !loading && results.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">⛵</div>
              <p className="empty-state-text">
                Ingen treff med disse søkekriteriene.
                <br />Prøv å justere filtrene.
              </p>
            </div>
          )}

          <ResultList
            results={results}
            totalCount={totalCount}
            onToggleFavorite={handleToggleFavorite}
            onSortChange={handleSortChange}
            sortKey={sortKey}
            sortDir={sortDir}
            onSourceChange={handleSourceChange}
            source={source}
            onStatusChange={handleStatusChange}
            status={status}
          />
          <ExternalLinks params={lastSearchParams} />
        </>
      )}

      {/* Favoritter-fane */}
      {tab === 'favorites' && (
        <>
          {favLoading && (
            <div className="empty-state">
              <span className="spinner" style={{ display: 'inline-block' }} />
            </div>
          )}
          {!favLoading && favorites.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🤍</div>
              <p className="empty-state-text">
                Ingen favoritter ennå.
                <br />Trykk på hjertet på en båt for å lagre den.
              </p>
            </div>
          )}
          {!favLoading && favorites.length > 0 && (
            <ResultList
              results={favorites}
              totalCount={favorites.length}
              onToggleFavorite={handleToggleFavorite}
              onSortChange={() => {}}
              sortKey="price_nok"
              sortDir="asc"
              onSourceChange={() => {}}
              source="all"
              onStatusChange={() => {}}
              status="all"
            />
          )}
        </>
      )}

      <footer className="app-footer">
        Katamaran langtur 2029 — Finn.no · Blocket.se · Yachtworld · Boat24
      </footer>
    </div>
  );
}
