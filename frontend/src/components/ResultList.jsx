import { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import ResultCard from './ResultCard';

const SORT_OPTIONS = [
  { key: 'price_nok',      label: 'Pris' },
  { key: 'year',           label: 'Årsmodell' },
  { key: 'length_ft',      label: 'Størrelse' },
  { key: 'first_seen_at',  label: 'Nyeste' },
];

const SOURCE_FILTERS = [
  { key: 'all',     label: 'Alle' },
  { key: 'finn',    label: '🇳🇴 Finn' },
  { key: 'blocket', label: '🇸🇪 Blocket' },
  { key: 'dba',     label: '🇩🇰 DBA' },
];

const STATUS_FILTERS = [
  { key: 'active', label: 'Aktive' },
  { key: 'all',    label: 'Alle inkl. solgte' },
  { key: 'sold',   label: 'Solgte' },
];

export default function ResultList({ results, totalCount, onToggleFavorite, onSortChange, sortKey, sortDir, onSourceChange, source, onStatusChange, status }) {
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
      {/* Header */}
      <div className="results-header">
        <div className="results-count">
          <span className="count-number">{results.length}</span>
          <span className="count-label"> treff</span>
        </div>

        {/* Kilde-tabs */}
        <div className="filter-tabs">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-tab ${source === f.key ? 'filter-tab-active' : ''}`}
              onClick={() => onSourceChange(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sortering + statusfilter */}
      <div className="controls-row">
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

        <div className="status-controls">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-tab ${status === f.key ? 'filter-tab-active' : ''}`}
              onClick={() => onStatusChange(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kortgrid */}
      <div className="results-grid">
        {results.map((boat) => (
          <ResultCard
            key={`${boat.source}-${boat.id}`}
            boat={boat}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
