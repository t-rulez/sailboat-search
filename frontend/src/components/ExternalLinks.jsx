import { ExternalLink } from 'lucide-react';
import { getExchangeRates } from '../utils/currency';
import { useState, useEffect } from 'react';

function buildFinnUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const params = new URLSearchParams({ q, class: '2188' });
  if (priceMin) params.set('price_from', priceMin);
  if (priceMax) params.set('price_to', priceMax);
  if (yearMin)  params.set('year_from', yearMin);
  if (sizeMin)  params.set('length_feet_from', sizeMin);
  if (sizeMax)  params.set('length_feet_to', sizeMax);
  params.append('sales_form', '120');
  params.append('sales_form', '121');
  return `https://www.finn.no/mobility/search/boat?${params}`;
}

function buildBlocketUrl({ brand, priceMin, priceMax, sizeMin, sizeMax, rates }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const sekRate = rates?.SEK ? 1 / rates.SEK : 10.2;
  const params = new URLSearchParams({ q, class: '2188' });
  if (priceMin) params.set('price_from', Math.round(parseInt(priceMin) * sekRate));
  if (priceMax) params.set('price_to',   Math.round(parseInt(priceMax) * sekRate));
  if (sizeMin)  params.set('length_feet_from', sizeMin);
  if (sizeMax)  params.set('length_feet_to', sizeMax);
  // Blocket støtter ikke year_from
  return `https://www.blocket.se/mobility/search/boat?${params}`;
}

function buildYachtworldUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, rates }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const usdRate = rates?.USD ? 1 / rates.USD : 0.095;
  const params = new URLSearchParams({ q });
  if (yearMin)  params.set('year_min', yearMin);
  if (priceMin) params.set('price_min', Math.round(parseInt(priceMin) * usdRate));
  if (priceMax) params.set('price_max', Math.round(parseInt(priceMax) * usdRate));
  if (sizeMin)  params.set('loa_min', Math.round(parseInt(sizeMin) * 0.3048));
  if (sizeMax)  params.set('loa_max', Math.round(parseInt(sizeMax) * 0.3048));
  return `https://www.yachtworld.com/boats-for-sale/type-sail/?${params}&country=NO,SE,DK`;
}

function buildBoat24Url({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax }) {
  const params = new URLSearchParams();
  if (brand)    params.set('src', brand);
  params.set('cat', '1');
  params.append('typ[]', '231');  // Katamaran
  params.set('whr', 'NOK');       // Priser i NOK
  if (priceMin) params.set('prs_min', priceMin);
  if (priceMax) params.set('prs_max', priceMax);
  if (sizeMin)  params.set('lge_min', Math.round(parseInt(sizeMin) * 0.3048));
  if (sizeMax)  params.set('lge_max', Math.round(parseInt(sizeMax) * 0.3048));
  if (yearMin)  params.set('jhr_min', yearMin);
  params.append('rgo[]', '43');   // Norge
  params.append('rgo[]', '49');   // Sverige
  params.append('rgo[]', '15');   // Danmark
  params.set('slt', '0');
  return `https://www.boat24.com/no/seilbater/?${params}`;
}

const SOURCES = [
  { key: 'finn',    label: 'Finn.no',    flag: '🇳🇴', build: buildFinnUrl },
  { key: 'blocket', label: 'Blocket.se', flag: '🇸🇪', build: buildBlocketUrl },
  { key: 'boat24',  label: 'Boat24',     flag: '🌍', build: buildBoat24Url },
];

export default function ExternalLinks({ params }) {
  const [rates, setRates] = useState(null);

  useEffect(() => {
    getExchangeRates().then(setRates);
  }, []);

  if (!params) return null;

  return (
    <section className="external-section">
      <div className="external-header">
        <div className="divider-line" />
        <span className="divider-text">Søk direkte på nettsidene</span>
        <div className="divider-line" />
      </div>
      <p className="external-desc">
        Åpner ferdig-filtrert søk med dine søkeparametere.
      </p>
      <div className="external-links">
        {SOURCES.map((src) => (
          <a
            key={src.key}
            href={src.build({ ...params, rates })}
            target="_blank"
            rel="noopener noreferrer"
            className="external-btn"
          >
            <div className="external-flag">{src.flag}</div>
            <div className="external-info">
              <div className="external-site">{src.label}</div>
            </div>
            <ExternalLink size={16} className="external-arrow" />
          </a>
        ))}
      </div>
    </section>
  );
}
