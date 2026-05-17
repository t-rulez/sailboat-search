import { ExternalLink } from 'lucide-react';
import { getExchangeRates } from '../utils/currency';
import { useState, useEffect } from 'react';

function buildBlocketUrl({ brand, yearMin, priceMin, priceMax, rates }) {
  const q = ['katamaran', brand].filter(Boolean).join(' ');
  const sekRate = rates?.SEK ? 1 / rates.SEK : 10.2;
  const params = new URLSearchParams({ q });
  if (yearMin)   params.append('year_from', yearMin);
  if (priceMin)  params.append('price_from', Math.round(priceMin * sekRate));
  if (priceMax)  params.append('price_to',   Math.round(priceMax * sekRate));
  return `https://www.blocket.se/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar?${params}`;
}

function buildYachtworldUrl({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, rates }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const usdRate = rates?.USD ? 1 / rates.USD : 0.095;
  const params = new URLSearchParams({ q });
  if (yearMin)  params.set('year_min', yearMin);
  if (sizeMin)  params.set('loa_min', Math.round(sizeMin * 0.3048));
  if (sizeMax)  params.set('loa_max', Math.round(sizeMax * 0.3048));
  if (priceMin) params.set('price_min', Math.round(priceMin * usdRate));
  if (priceMax) params.set('price_max', Math.round(priceMax * usdRate));
  // Søk Norge + Sverige + Danmark separat siden komma-format ikke virker
  return `https://www.yachtworld.com/boats-for-sale/type-sail/?${params}&country=NO,SE,DK`;
}

function buildBoat24Url({ brand, yearMin, priceMin, priceMax, sizeMin, sizeMax, rates }) {
  const q = ['catamaran', brand].filter(Boolean).join(' ');
  const eurRate = rates?.EUR ? 1 / rates.EUR : 0.085;
  const params = new URLSearchParams({ q });
  ['NO', 'SE', 'DK'].forEach((c) => params.append('country[]', c));
  if (yearMin)  params.set('year_from', yearMin);
  if (priceMin) params.set('price_from', Math.round(priceMin * eurRate));
  if (priceMax) params.set('price_to',   Math.round(priceMax * eurRate));
  if (sizeMin)  params.set('length_from', Math.round(sizeMin * 0.3048));
  if (sizeMax)  params.set('length_to',   Math.round(sizeMax * 0.3048));
  return `https://www.boat24.com/en/sailboats/?${params}`;
}

const SOURCES = [
  {
    key: 'blocket',
    label: 'Blocket.se',
    flag: '🇸🇪',
    sub: 'Sverige — priser i SEK',
    build: buildBlocketUrl,
  },
  {
    key: 'yachtworld',
    label: 'Yachtworld',
    flag: '🌍',
    sub: 'NO · SE · DK — priser i USD',
    build: buildYachtworldUrl,
  },
  {
    key: 'boat24',
    label: 'Boat24',
    flag: '🌍',
    sub: 'NO · SE · DK — priser i EUR',
    build: buildBoat24Url,
  },
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
        <span className="divider-text">Søk også i Sverige og resten av Norden</span>
        <div className="divider-line" />
      </div>
      <p className="external-desc">
        Åpner ferdig-filtrert søk i ny fane med live-konverterte priser.
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
              <div className="external-sub">{src.sub}</div>
            </div>
            <ExternalLink size={16} className="external-arrow" />
          </a>
        ))}
      </div>
      {rates && (
        <div className="rate-info">
          <span>Kurser: </span>
          <span className="rate-badge">1 SEK = {rates.SEK.toFixed(3)} NOK</span>
          <span className="rate-badge">1 USD = {rates.USD.toFixed(2)} NOK</span>
          <span className="rate-badge">1 EUR = {rates.EUR.toFixed(2)} NOK</span>
        </div>
      )}
    </section>
  );
}
