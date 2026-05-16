import { ExternalLink, Calendar, Ruler, Banknote, Tag } from 'lucide-react';
import { formatNOK } from '../utils/currency';

const SOURCE_LABELS = {
  finn: { label: 'Finn.no', flag: '🇳🇴' },
  blocket: { label: 'Blocket.se', flag: '🇸🇪' },
  dba: { label: 'DBA.dk', flag: '🇩🇰' },
};

function FotMeter({ ft }) {
  if (!ft) return <span>—</span>;
  const m = (ft * 0.3048).toFixed(1);
  return <span>{ft} fot <span className="text-rope-500">/ {m} m</span></span>;
}

export default function ResultCard({ boat }) {
  const src = SOURCE_LABELS[boat.source] || { label: boat.source, flag: '🌍' };

  return (
    <article className="boat-card">
      {/* Bilde */}
      <div className="boat-image-wrap">
        {boat.image ? (
          <img
            src={boat.image}
            alt={boat.title}
            className="boat-image"
            loading="lazy"
            onError={(e) => {
              e.target.parentElement.classList.add('no-image');
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="boat-image-placeholder">
            <span className="text-4xl opacity-30">⛵</span>
          </div>
        )}
        <span className="source-badge">
          {src.flag} {src.label}
        </span>
        {boat.brand && (
          <span className="brand-badge">{boat.brand}</span>
        )}
      </div>

      {/* Info */}
      <div className="boat-info">
        <h3 className="boat-title">{boat.title}</h3>

        <div className="boat-meta">
          <div className="meta-item">
            <Banknote size={14} className="meta-icon text-compass-gold" />
            <span className="meta-value price">{formatNOK(boat.price_nok)}</span>
          </div>

          <div className="meta-item">
            <Calendar size={14} className="meta-icon" />
            <span className="meta-value">{boat.year || '—'}</span>
          </div>

          <div className="meta-item">
            <Ruler size={14} className="meta-icon" />
            <span className="meta-value"><FotMeter ft={boat.length_ft} /></span>
          </div>

          {boat.brand && (
            <div className="meta-item">
              <Tag size={14} className="meta-icon" />
              <span className="meta-value">{boat.brand}</span>
            </div>
          )}

          {boat.location && (
            <div className="meta-item col-span-2">
              <span className="meta-icon">📍</span>
              <span className="meta-value text-rope-400">{boat.location}</span>
            </div>
          )}
        </div>

        <a
          href={boat.url}
          target="_blank"
          rel="noopener noreferrer"
          className="view-btn"
        >
          Se annonsen
          <ExternalLink size={14} />
        </a>
      </div>
    </article>
  );
}
