import { useState } from 'react';
import { Search } from 'lucide-react';

const DEFAULT_PARAMS = {
  boatType: 'katamaran',
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

export default function SearchForm({ onSearch, loading }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);

  const update = (key, val) => setParams((p) => ({ ...p, [key]: val }));

  const handleSubmit = () => {
    onSearch(params);
  };

  return (
    <div className="search-form">
      {/* Type båt */}
      <div className="field-group">
        <label className="field-label">Type båt</label>
        <input
          className="field-input"
          type="text"
          value={params.boatType}
          onChange={(e) => update('boatType', e.target.value)}
          placeholder="f.eks. katamaran"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {/* Båtmerke */}
      <div className="field-group">
        <label className="field-label">Båtmerke</label>
        <input
          className="field-input"
          type="text"
          value={params.brand}
          onChange={(e) => update('brand', e.target.value)}
          placeholder="f.eks. Lagoon"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {/* Årsmodell */}
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

      {/* Pris */}
      <div className="field-group col-span-2">
        <label className="field-label">
          Pris (NOK) — {formatMillions(params.priceMin)} – {formatMillions(params.priceMax)}
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="field-sublabel">Fra</label>
            <input
              className="field-input"
              type="number"
              value={params.priceMin}
              onChange={(e) => update('priceMin', parseInt(e.target.value) || 0)}
              step={500000}
            />
          </div>
          <div className="flex-1">
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

      {/* Størrelse */}
      <div className="field-group col-span-2">
        <label className="field-label">
          Størrelse (fot) — {params.sizeMin}–{params.sizeMax} fot
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
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
          <div className="flex-1">
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

      {/* Søk-knapp */}
      <div className="col-span-2">
        <button
          className="search-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="spinner" />
              Søker…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search size={18} />
              Søk på Finn.no
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
