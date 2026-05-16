import { useState } from 'react';
import { Search } from 'lucide-react';

const DEFAULT_PARAMS = {
  brand: '',
  yearMin: 2020,
  priceMin: 3000000,
  priceMax: 6000000,
  sizeMin: 38,
  sizeMax: 42,
};

function formatMillions(val) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.', ',')} mill`;
  return `${(val / 1000).toFixed(0)} 000`;
}

export default function SearchForm({ onSearch, loading, initialParams }) {
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...initialParams });
  const update = (key, val) => setParams((p) => ({ ...p, [key]: val }));

  return (
    <div className="search-form">

      {/* Rad 1: Merke + Årsmodell */}
      <div className="form-row">
        <div className="field-group">
          <label className="field-label">Båtmerke</label>
          <input
            className="field-input"
            type="text"
            value={params.brand}
            onChange={(e) => update('brand', e.target.value)}
            placeholder="f.eks. Lagoon"
            onKeyDown={(e) => e.key === 'Enter' && onSearch(params)}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Nyere enn</label>
          <input
            className="field-input"
            type="number"
            value={params.yearMin}
            onChange={(e) => update('yearMin', parseInt(e.target.value) || 2000)}
            min={1980}
            max={2025}
          />
        </div>
      </div>

      {/* Rad 2: Pris */}
      <div className="field-group">
        <label className="field-label">
          Pris (NOK) — {formatMillions(params.priceMin)} – {formatMillions(params.priceMax)}
        </label>
        <div className="form-row">
          <div className="field-group">
            <label className="field-sublabel">Fra</label>
            <input
              className="field-input"
              type="number"
              value={params.priceMin}
              onChange={(e) => update('priceMin', parseInt(e.target.value) || 0)}
              step={500000}
            />
          </div>
          <div className="field-group">
            <label className="field-sublabel">Til</label>
            <input
              className="field-input"
              type="number"
              value={params.priceMax}
              onChange={(e) => update('priceMax', parseInt(e.target.value) || 10000000)}
              step={500000}
            />
          </div>
        </div>
      </div>

      {/* Rad 3: Størrelse */}
      <div className="field-group">
        <label className="field-label">
          Størrelse (fot) — {params.sizeMin}–{params.sizeMax} fot
        </label>
        <div className="form-row">
          <div className="field-group">
            <label className="field-sublabel">Fra</label>
            <input
              className="field-input"
              type="number"
              value={params.sizeMin}
              onChange={(e) => update('sizeMin', parseInt(e.target.value) || 30)}
              min={20}
              max={100}
            />
          </div>
          <div className="field-group">
            <label className="field-sublabel">Til</label>
            <input
              className="field-input"
              type="number"
              value={params.sizeMax}
              onChange={(e) => update('sizeMax', parseInt(e.target.value) || 60)}
              min={20}
              max={100}
            />
          </div>
        </div>
      </div>

      {/* Knapp */}
      <button className="search-btn" onClick={() => onSearch(params)} disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2"><span className="spinner" />Søker…</span>
        ) : (
          <span className="flex items-center gap-2"><Search size={18} />Filtrer</span>
        )}
      </button>

      {/* Katamaran-ikon */}
      <div className="catamaran-icon">
        <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
          {/* Venstre skrog */}
          <path d="M2,44 Q10,52 28,52 L28,46 Q12,46 6,40 Z" fill="#d4b896"/>
          {/* Høyre skrog */}
          <path d="M72,44 Q80,52 98,52 L94,40 Q86,46 72,46 Z" fill="#d4b896"/>
          {/* Bro */}
          <rect x="24" y="36" width="52" height="5" rx="2" fill="#c09a6a"/>
          {/* Mast */}
          <line x1="50" y1="4" x2="50" y2="38" stroke="#e8d5b0" stroke-width="2"/>
          {/* Storseil */}
          <polygon points="50,6 50,38 74,38" fill="#e8d5b0" opacity="0.85"/>
          {/* Forseil */}
          <polygon points="50,14 50,38 28,38" fill="#c09a6a" opacity="0.8"/>
        </svg>
      </div>

    </div>
  );
}
