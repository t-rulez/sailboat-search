import { Calendar, Banknote, Tag, Heart, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

const SOURCE_LABELS = {
  finn:        { label: 'Finn.no',       flag: '🇳🇴' },
  blocket:     { label: 'Blocket.se',    flag: '🇸🇪' },
  yachtworld:  { label: 'Yachtworld',    flag: '🌍' },
  boat24:      { label: 'Boat24',        flag: '🌍' },
};

function formatNOK(amount) {
  if (!amount) return '—';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency', currency: 'NOK', maximumFractionDigits: 0,
  }).format(amount);
}

function PriceChange({ currentPrice, initialPrice }) {
  if (!currentPrice || !initialPrice || currentPrice === initialPrice) return null;
  const diff = currentPrice - initialPrice;
  const pct  = Math.round((diff / initialPrice) * 100);
  const down  = diff < 0;
  return (
    <span className={`price-change ${down ? 'price-down' : 'price-up'}`}>
      {down ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
      {down ? '' : '+'}{formatNOK(diff)} ({pct > 0 ? '+' : ''}{pct}%)
    </span>
  );
}

export default function ResultCard({ boat, onToggleFavorite }) {
  const src = SOURCE_LABELS[boat.source] || { label: boat.source, flag: '🌍' };
  const isSold = boat.status !== 'active';

  return (
    <article className={`boat-card ${isSold ? 'boat-card-inactive' : ''}`}>
      {/* Bilde */}
      <div className="boat-image-wrap">
        {boat.image_url ? (
          <img
            src={boat.image_url}
            alt={boat.title}
            className="boat-image"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="boat-image-placeholder">
            <span className="text-4xl opacity-30">⛵</span>
          </div>
        )}

        {/* Kilde-badge */}
        <span className="source-badge">{src.flag} {src.label}</span>

        {/* Merke-badge */}
        {boat.brand && <span className="brand-badge">{boat.brand}</span>}

        {/* Status-overlay hvis solgt/fjernet */}
        {isSold && (
          <div className="sold-overlay">
            <StatusBadge status={boat.status} />
          </div>
        )}
      </div>

      {/* Favoritt-hjerte – utenfor bildet så overflow:hidden ikke skjuler det */}
      <button
        className={`fav-btn ${boat.is_favorite ? 'fav-btn-active' : ''}`}
        onClick={(e) => { e.preventDefault(); onToggleFavorite(boat); }}
        title={boat.is_favorite ? 'Fjern favoritt' : 'Legg til favoritt'}
      >
        <Heart size={16} fill={boat.is_favorite ? 'currentColor' : 'none'} />
      </button>

      {/* Info */}
      <div className="boat-info">
        <h3 className="boat-title">{boat.title}</h3>

        <div className="boat-meta">
          {/* Pris */}
          <div className="meta-item meta-full">
            <Banknote size={14} className="meta-icon" />
            <span className="meta-value price">{formatNOK(boat.price_nok)}</span>
            <PriceChange
              currentPrice={boat.price_nok}
              initialPrice={boat.initial_price_nok}
            />
          </div>

          {/* Årsmodell */}
          <div className="meta-item">
            <Calendar size={14} className="meta-icon" />
            <span className="meta-value">{boat.year || '—'}</span>
          </div>

          {/* Størrelse */}
{/* Merke */}
          {boat.brand && (
            <div className="meta-item">
              <Tag size={14} className="meta-icon" />
              <span className="meta-value">{boat.brand}</span>
            </div>
          )}

          {/* Sted */}
          {boat.location && (
            <div className="meta-item meta-full">
              <span className="meta-icon">📍</span>
              <span className="meta-value meta-secondary">{boat.location}</span>
            </div>
          )}

          {(boat.first_seen_at || boat.last_changed_at) && (
            <div className="meta-item meta-full">
              <Clock size={14} className="meta-icon" />
              <span className="meta-value meta-secondary">
                Oppdaget {new Date(boat.first_seen_at || boat.last_changed_at).toLocaleDateString('nb-NO')}
              </span>
            </div>
          )}
        </div>

        <a
          href={boat.url}
          target={boat.source === 'finn' ? '_blank' : undefined}
          rel={boat.source === 'finn' ? 'noopener noreferrer' : undefined}
          className="view-btn"
        >
          Se annonsen
        </a>
      </div>
    </article>
  );
}
