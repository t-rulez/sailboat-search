import { useState } from 'react';
import SearchForm from './components/SearchForm';
import ResultList from './components/ResultList';
import ExternalLinks from './components/ExternalLinks';
import { useBoatSearch } from './hooks/useBoatSearch';

export default function App() {
  const { results, loading, error, rates, search, lastSearchParams, totalCount } = useBoatSearch();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (params) => {
    setHasSearched(true);
    search(params);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <p className="header-eyebrow">⚓ Skandinavisk Båtsøk</p>
        <h1 className="app-title">Finn din seilbåt</h1>
        <p className="app-subtitle">Søker Finn.no · linker til Blocket.se og DBA.dk</p>
      </header>

      {/* Søkeskjema */}
      <SearchForm onSearch={handleSearch} loading={loading} />

      {/* Feilmelding */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Ingen resultater */}
      {hasSearched && !loading && results.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">⛵</div>
          <p className="empty-state-text">
            Ingen treff på Finn.no med disse søkekriteriene.
            <br />Prøv å justere filtrene, eller søk på Blocket og DBA nedenfor.
          </p>
        </div>
      )}

      {/* Resultater fra Finn.no */}
      <ResultList results={results} totalCount={totalCount} />

      {/* Lenker til Blocket og DBA */}
      {hasSearched && (
        <ExternalLinks params={lastSearchParams} rates={rates} />
      )}

      {/* Footer */}
      <footer className="app-footer">
        Båtsøk — Data fra Finn.no, Blocket.se og DBA.dk. Ikke tilknyttet noen av disse tjenestene.
      </footer>
    </div>
  );
}
