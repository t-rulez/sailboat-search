import { useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

const DEFAULT_PARAMS = {
  brand: '',
  yearMin: 2020,
  priceMin: 3000000,
  priceMax: 6000000,
  sizeMin: 38,
  sizeMax: 42,
};

const EMPTY_PARAMS = {
  brand: '',
  yearMin: '',
  priceMin: '',
  priceMax: '',
  sizeMin: '',
  sizeMax: '',
};

function formatMillions(val) {
  if (val === '' || val === null || val === undefined) return '—';
  if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.', ',')} mill`;
  return `${(val / 1000).toFixed(0)} 000`;
}

function ClearableInput({ label, sublabel, value, onChange, onClear, type = 'number', placeholder, ...rest }) {
  return (
    <div className="field-group">
      {label && <label className="field-label">{label}</label>}
      {sublabel && <label className="field-sublabel">{sublabel}</label>}
      <div className="field-input-wrap">
        <input
          className="field-input field-input-clearable"
          type={type}
          value={value}
          placeholder={placeholder || '—'}
          onChange={onChange}
          {...rest}
        />
        {(value !== '' && value !== null && value !== undefined) && (
          <button className="field-clear-btn" onClick={onClear} type="button" tabIndex={-1}>
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SearchForm({ onSearch, onReset, loading, initialParams }) {
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...initialParams });
  const update = (key, val) => setParams((p) => ({ ...p, [key]: val }));
  const clear  = (key) => setParams((p) => ({ ...p, [key]: '' }));

  const handleReset = () => {
    setParams(EMPTY_PARAMS);
    if (onReset) onReset();
  };

  const parseNum = (val) => val === '' ? '' : parseInt(val) || '';

  return (
    <div className="search-form">

      {/* Rad 1: Søkeord + Årsmodell */}
      <div className="form-row">
        <div className="field-group">
          <label className="field-label">Søkeord</label>
          <div className="field-input-wrap">
            <input
              className="field-input field-input-clearable"
              type="text"
              value={params.brand}
              onChange={(e) => update('brand', e.target.value)}
              placeholder="f.eks. Lagoon"
              onKeyDown={(e) => e.key === 'Enter' && onSearch(params)}
            />
            {params.brand && (
              <button className="field-clear-btn" onClick={() => clear('brand')} type="button" tabIndex={-1}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <ClearableInput
          label="Nyere enn"
          value={params.yearMin}
          onChange={(e) => update('yearMin', parseNum(e.target.value))}
          onClear={() => clear('yearMin')}
          min={1980} max={2030}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(params)}
        />
      </div>

      {/* Rad 2: Pris */}
      <div className="field-group">
        <label className="field-label">
          Pris (NOK)
          {params.priceMin !== '' && params.priceMax !== ''
            ? ` — ${formatMillions(params.priceMin)} – ${formatMillions(params.priceMax)}`
            : params.priceMin !== '' ? ` — fra ${formatMillions(params.priceMin)}`
            : params.priceMax !== '' ? ` — til ${formatMillions(params.priceMax)}`
            : ''}
        </label>
        <div className="form-row">
          <ClearableInput
            sublabel="Fra"
            value={params.priceMin}
            onChange={(e) => update('priceMin', parseNum(e.target.value))}
            onClear={() => clear('priceMin')}
            step={500000}
          />
          <ClearableInput
            sublabel="Til"
            value={params.priceMax}
            onChange={(e) => update('priceMax', parseNum(e.target.value))}
            onClear={() => clear('priceMax')}
            step={500000}
          />
        </div>
      </div>

      {/* Rad 3: Størrelse */}
      <div className="field-group">
        <label className="field-label">
          Størrelse (fot)
          {params.sizeMin !== '' && params.sizeMax !== ''
            ? ` — ${params.sizeMin}–${params.sizeMax} fot`
            : params.sizeMin !== '' ? ` — fra ${params.sizeMin} fot`
            : params.sizeMax !== '' ? ` — til ${params.sizeMax} fot`
            : ''}
        </label>
        <div className="form-row">
          <ClearableInput
            sublabel="Fra"
            value={params.sizeMin}
            onChange={(e) => update('sizeMin', parseNum(e.target.value))}
            onClear={() => clear('sizeMin')}
            min={20} max={100}
          />
          <ClearableInput
            sublabel="Til"
            value={params.sizeMax}
            onChange={(e) => update('sizeMax', parseNum(e.target.value))}
            onClear={() => clear('sizeMax')}
            min={20} max={100}
          />
        </div>
      </div>

      {/* Knapper */}
      <div className="form-row form-buttons">
        <button className="reset-btn" onClick={handleReset} type="button">
          <RotateCcw size={15} />
          Nullstill
        </button>
        <button className="search-btn" onClick={() => onSearch(params)} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2"><span className="spinner" />Søker…</span>
          ) : (
            <span className="flex items-center gap-2"><Search size={18} />Søk</span>
          )}
        </button>
      </div>

      {/* Katamaran-ikon */}
      <div className="catamaran-icon">
        <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
          <path d="M2,44 Q10,52 28,52 L28,46 Q12,46 6,40 Z" fill="#d4b896"/>
          <path d="M72,44 Q80,52 98,52 L94,40 Q86,46 72,46 Z" fill="#d4b896"/>
          <rect x="24" y="36" width="52" height="5" rx="2" fill="#c09a6a"/>
          <line x1="50" y1="4" x2="50" y2="38" stroke="#e8d5b0" stroke-width="2"/>
          <polygon points="50,6 50,38 74,38" fill="#e8d5b0" opacity="0.85"/>
          <polygon points="50,14 50,38 28,38" fill="#c09a6a" opacity="0.8"/>
        </svg>
      </div>

    </div>
  );
}
