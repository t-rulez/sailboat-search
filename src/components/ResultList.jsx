import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import ResultCard from './ResultCard';

const SORT_OPTIONS = [
  { key: 'price_nok', label: 'Pris' },
  { key: 'year', label: 'Årsmodell' },
  { key: 'length_ft', label: 'Størrelse' },
];

export default function ResultList({ results, totalCount }) {
  const [sortKey, setSortKey] = useState('price_nok');
  const [sortDir, setSortDir] = useState('asc');

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      const bv = b[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [results, sortKey, sortDir]);

  if (results.length === 0) return null;

  return (
    <section className="results-section">
      {/* Header med sortering */}
      <div className="results-header">
        <div className="results-count">
          <span className="count-number">{results.length}</span>
          <span className="count-label">
            {totalCount > results.length ? ` av ${totalCount} ` : ' '}
            treff på Finn.no
          </span>
        </div>

        <div className="sort-controls">
          <span className="sort-label">Sorter:</span>
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <button
                key={opt.key}
                className={`sort-btn ${active ? 'sort-btn-active' : ''}`}
                onClick={() => toggleSort(opt.key)}
              >
                {opt.label}
                {active ? (
                  sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                ) : (
                  <ArrowUpDown size={12} className="opacity-40" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kortgrid */}
      <div className="results-grid">
        {sorted.map((boat) => (
          <ResultCard key={`${boat.source}-${boat.id}`} boat={boat} />
        ))}
      </div>
    </section>
  );
}
