import { ExternalLink } from 'lucide-react';
import { buildBlocketUrl, buildDbaUrl } from '../utils/externalLinks';
import { formatNOK } from '../utils/currency';

export default function ExternalLinks({ params, rates }) {
  if (!params) return null;

  const blocketUrl = buildBlocketUrl({ ...params, rates });
  const dbaUrl = buildDbaUrl({ ...params, rates });

  return (
    <section className="external-section">
      <div className="external-header">
        <div className="divider-line" />
        <span className="divider-text">Søk også i Sverige og Danmark</span>
        <div className="divider-line" />
      </div>

      <p className="external-desc">
        Prisene konverteres til NOK med live valutakurs.
        Klikk for å åpne ferdig-filtrert søk i ny fane.
      </p>

      <div className="external-links">
        <a
          href={blocketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="external-btn"
        >
          <div className="external-flag">🇸🇪</div>
          <div className="external-info">
            <div className="external-site">Blocket.se</div>
            <div className="external-sub">Sverige — priser i SEK</div>
          </div>
          <ExternalLink size={16} className="external-arrow" />
        </a>

        <a
          href={dbaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="external-btn"
        >
          <div className="external-flag">🇩🇰</div>
          <div className="external-info">
            <div className="external-site">DBA.dk</div>
            <div className="external-sub">Danmark — priser i DKK</div>
          </div>
          <ExternalLink size={16} className="external-arrow" />
        </a>
      </div>

      {rates && (
        <div className="rate-info">
          <span>Valutakurser: </span>
          <span className="rate-badge">1 SEK = {(rates.SEK).toFixed(3)} NOK</span>
          <span className="rate-badge">1 DKK = {(rates.DKK).toFixed(3)} NOK</span>
        </div>
      )}
    </section>
  );
}
