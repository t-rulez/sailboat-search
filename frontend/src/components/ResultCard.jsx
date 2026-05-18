import { Calendar, Banknote, Tag, Heart, TrendingDown, TrendingUp, Clock, MessageSquare } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SOURCE_LABELS = {
  finn:        { label: 'Finn.no',    flag: '🇳🇴' },
  blocket:     { label: 'Blocket.se', flag: '🇸🇪' },
  yachtworld:  { label: 'Yachtworld', flag: '🌍' },
  boat24:      { label: 'Boat24',     flag: '🌍' },
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

function CommentModal({ boat, onClose, onSave }) {
  const [text, setText] = useState(boat.comment || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    console.log('Lagrer kommentar:', { source: boat.source, external_id: boat.external_id, text });
    try {
      const res = await fetch(
        `${API_URL}/api/listings/comment/${boat.source}/${boat.external_id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: text }),
        }
      );
      console.log('Svar status:', res.status);
      if (res.ok) {
        onSave(text);
        onClose();
      } else {
        const err = await res.json();
        console.error('Feil fra server:', err);
      }
    } catch (e) {
      console.error('Lagring feilet:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Notat</h3>
        <p className="modal-subtitle">{boat.title}</p>
        <textarea
          className="modal-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Skriv en kommentar..."
          rows={5}
          autoFocus
        />
        <div className="modal-buttons">
          <button className="modal-btn-cancel" onClick={onClose}>Avbryt</button>
          <button className="modal-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultCard({ boat, onToggleFavorite, showComment = false }) {
  const src = SOURCE_LABELS[boat.source] || { label: boat.source, flag: '🌍' };
  const isSold = boat.status !== 'active';
  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState(boat.comment || '');

  return (
    <>
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
          <span className="source-badge">{src.flag} {src.label}</span>
          {boat.brand && <span className="brand-badge">{boat.brand}</span>}
          {isSold && (
            <div className="sold-overlay"><StatusBadge status={boat.status} /></div>
          )}
        </div>

        {/* Favoritt-knapp */}
        <button
          className={`fav-btn ${boat.is_favorite ? 'fav-btn-active' : ''}`}
          onClick={(e) => { e.preventDefault(); onToggleFavorite(boat); }}
          title={boat.is_favorite ? 'Fjern favoritt' : 'Legg til favoritt'}
        >
          <Heart size={16} fill={boat.is_favorite ? 'currentColor' : 'none'} />
        </button>

        {/* Kommentar-knapp — kun på favoritter */}
        {showComment && (
          <button
            className={`comment-btn ${comment ? 'comment-btn-active' : ''}`}
            onClick={(e) => { e.preventDefault(); setShowModal(true); }}
            title="Legg til notat"
          >
            <MessageSquare size={14} />
          </button>
        )}

        {/* Info */}
        <div className="boat-info">
          <h3 className="boat-title">{boat.title}</h3>

          <div className="boat-meta">
            <div className="meta-item meta-full">
              <Banknote size={14} className="meta-icon" />
              <span className="meta-value price">{formatNOK(boat.price_nok)}</span>
              <PriceChange currentPrice={boat.price_nok} initialPrice={boat.initial_price_nok} />
            </div>

            <div className="meta-item">
              <Calendar size={14} className="meta-icon" />
              <span className="meta-value">{boat.year || '—'}</span>
            </div>

            {boat.brand && (
              <div className="meta-item">
                <Tag size={14} className="meta-icon" />
                <span className="meta-value">{boat.brand}</span>
              </div>
            )}

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

          {/* Kommentar-visning */}
          {showComment && comment && (
            <div className="comment-display" onClick={() => setShowModal(true)}>
              <MessageSquare size={12} />
              <span>{comment}</span>
            </div>
          )}

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

      {showModal && (
        <CommentModal
          boat={{ ...boat, comment }}
          onClose={() => setShowModal(false)}
          onSave={(newComment) => setComment(newComment)}
        />
      )}
    </>
  );
}
