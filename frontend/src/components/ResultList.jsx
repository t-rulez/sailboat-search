import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import ResultCard from './ResultCard';

const SORT_OPTIONS = [
  { key: 'price_nok',     label: 'Pris' },
  { key: 'year',          label: 'Årsmodell' },
  { key: 'length_ft',     label: 'Størrelse' },
];

export default function ResultList({ results, totalCount, onToggleFavorite, onSortChange, sortKey, sortDir }) {
  const handleSort = (key) => {
    if (sortKey === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(key, 'asc');
    }
  };

  if (results.length === 0) return null;

  return (
    <section className="results-section">
      <div className="results-header">
        <div className="results-count">
          <span className="count-number">{results.length}</span>
          <span className="count-label"> treff</span>
        </div>

        <div className="sort-controls">
          <span className="sort-label">Sorter:</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                className={`sort-btn ${active ? 'sort-btn-active' : ''}`}
                onClick={() => handleSort(opt.key)}
              >
                {opt.label}
                {active
                  ? sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  : <ArrowUpDown size={12} className="opacity-40" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="results-grid">
        {results.map((boat) => (
          <ResultCard
            key={`${boat.source}-${boat.external_id}`}
            boat={boat}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
