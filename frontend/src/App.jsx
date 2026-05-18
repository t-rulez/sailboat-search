import { useState, useEffect, useCallback } from 'react';
import { Heart, Search } from 'lucide-react';
import SearchForm from './components/SearchForm';
import ResultList from './components/ResultList';
import ExternalLinks from './components/ExternalLinks';
import { useBoatSearch } from './hooks/useBoatSearch';
import { useFavorites } from './hooks/useFavorites';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
  const { results, loading, error, search, lastSearchParams, totalCount, updateFavorite } = useBoatSearch();
  const { toggle: toggleFav } = useFavorites();

  const [tab, setTab]               = useState('search');
  const [hasSearched, setHasSearched] = useState(false);
  const [sortKey, setSortKey]       = useState('first_seen_at');
  const [sortDir, setSortDir]       = useState('desc');
  const [source, setSource]         = useState('all');
  const [searchParams, setSearchParams] = useState(loadSavedParams());

  const [favorites, setFavorites]   = useState([]);
  const [favLoading, setFavLoading] = useState(false);

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
  }, []);

  useEffect(() => {
    fetchFavorites().catch(() => {});
  }, []);

  const handleReset = useCallback(() => {
    setHasSearched(false);
  }, []);

  const handleSearch = useCallback((params, src) => {
    const s = src !== undefined ? src : source;
    setSearchParams(params);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    setHasSearched(true);
    setTab('search');
    search(params, s);
  }, [search, source]);

  const handleSourceChange = useCallback((s) => {
    setSource(s);
    if (hasSearched) search(searchParams, s);
  }, [search, searchParams, hasSearched]);

  const handleToggleFavorite = useCallback(async (boat) => {
    const newVal = await toggleFav(boat);
    // Oppdater resultatlisten optimistisk
    updateFavorite(boat.source, boat.external_id, newVal);
    // Oppdater favorittlisten
    fetchFavorites();
  }, [toggleFav, updateFavorite, fetchFavorites]);

  // Sorter resultater lokalt
  const sortedResults = [...results].sort((a, b) => {
    const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const handleSortChange = (key, dir) => {
    setSortKey(key);
    setSortDir(dir);
  };

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
          <Search size={14} />
          Søk
        </button>
        <div className="tab-divider" />
        <button
          className={`app-tab ${tab === 'favorites' ? 'app-tab-active' : ''}`}
          onClick={() => { setTab('favorites'); fetchFavorites(); }}
        >
          <Heart size={14} />
          Favoritter{favorites.length > 0 && <span className="fav-count">({favorites.length})</span>}
        </button>
      </div>

      {/* Søk-fane */}
      {tab === 'search' && (
        <>
          <SearchForm
            onSearch={handleSearch}
            onReset={handleReset}
            loading={loading}
            initialParams={searchParams}
          />

          {/* Kilde-filter */}
          <div className="source-filter">
            {[
              { key: 'all',        label: 'Alle kilder' },
              { key: 'finn',       label: '🇳🇴 Finn.no' },
              { key: 'blocket',    label: '🇸🇪 Blocket.se' },
              { key: 'yachtworld', label: '🌍 Yachtworld' },
              { key: 'boat24',     label: '🌍 Boat24' },
            ].map(s => (
              <button
                key={s.key}
                className={`source-filter-btn ${source === s.key ? 'source-filter-btn-active' : ''}`}
                onClick={() => handleSourceChange(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="error-banner">⚠️ {error}</div>
          )}

          {hasSearched && !loading && results.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">⛵</div>
              <p className="empty-state-text">Ingen treff. Prøv å justere filtrene.</p>
            </div>
          )}

          <ResultList
            results={sortedResults}
            totalCount={totalCount}
            onToggleFavorite={handleToggleFavorite}
            onSortChange={handleSortChange}
            sortKey={sortKey}
            sortDir={sortDir}
          />

          {hasSearched && <ExternalLinks params={lastSearchParams} />}
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
                Ingen favoritter ennå.<br />Trykk på hjertet på en båt for å lagre den.
              </p>
            </div>
          )}
          {!favLoading && favorites.length > 0 && (
            <ResultList
              results={[...favorites].sort((a, b) => {
                const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
                const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
                if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                return sortDir === 'asc' ? av - bv : bv - av;
              })}
              totalCount={favorites.length}
              onToggleFavorite={handleToggleFavorite}
              onSortChange={handleSortChange}
              sortKey={sortKey}
              sortDir={sortDir}
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
