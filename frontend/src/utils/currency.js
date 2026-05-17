const FALLBACK_RATES = { SEK: 0.098, DKK: 0.148, USD: 10.5, EUR: 11.8 };
let cachedRates = null;
let cacheTime = null;
const CACHE_DURATION_MS = 60 * 60 * 1000;

export async function getExchangeRates() {
  if (cachedRates && cacheTime && Date.now() - cacheTime < CACHE_DURATION_MS) {
    return cachedRates;
  }
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK,USD,EUR');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    cachedRates = {
      SEK: 1 / data.rates.SEK,
      DKK: 1 / data.rates.DKK,
      USD: 1 / data.rates.USD,
      EUR: 1 / data.rates.EUR,
    };
    cacheTime = Date.now();
    return cachedRates;
  } catch (e) {
    console.warn('Valuta-API feilet, bruker fallback:', e.message);
    return FALLBACK_RATES;
  }
}

export function formatNOK(amount) {
  if (!amount || isNaN(amount)) return '—';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency', currency: 'NOK', maximumFractionDigits: 0,
  }).format(amount);
}
