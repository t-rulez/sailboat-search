// Henter live valutakurser fra frankfurter.app (gratis, ingen API-nøkkel)
// Fallback til statiske kurser hvis API er nede

const FALLBACK_RATES = {
  SEK: 0.098, // 1 SEK = ~0.098 NOK (altså 1 NOK ≈ 10.2 SEK)
  DKK: 0.148, // 1 DKK = ~0.148 NOK (altså 1 NOK ≈ 6.75 DKK)
};

let cachedRates = null;
let cacheTime = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 time

export async function getExchangeRates() {
  if (cachedRates && cacheTime && Date.now() - cacheTime < CACHE_DURATION_MS) {
    return cachedRates;
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    // data.rates inneholder NOK→SEK og NOK→DKK
    // Vi trenger SEK→NOK og DKK→NOK
    cachedRates = {
      SEK: 1 / data.rates.SEK, // Pris i SEK * denne = NOK
      DKK: 1 / data.rates.DKK,
    };
    cacheTime = Date.now();
    return cachedRates;
  } catch (e) {
    console.warn('Valuta-API feilet, bruker fallback-kurser:', e.message);
    return FALLBACK_RATES;
  }
}

export function formatNOK(amount) {
  if (!amount || isNaN(amount)) return '—';
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function convertToNOK(amount, fromCurrency, rates) {
  if (!amount || isNaN(amount)) return null;
  const rate = rates[fromCurrency];
  if (!rate) return amount;
  return Math.round(amount * rate);
}
