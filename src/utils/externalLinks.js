// Bygger ferdig-filtrerte søke-URLer for Blocket.se og DBA.dk
// Disse åpnes i ny fane siden vi ikke kan scrape dem direkte fra nettleseren

/**
 * Blocket.se – Sverige
 * Valuta: SEK. 1 NOK ≈ 10.2 SEK (ca)
 */
export function buildBlocketUrl({ boatType, yearMin, priceMinNOK, priceMaxNOK, sizeMinFt, sizeMaxFt, rates }) {
  const sekRate = rates?.SEK ? 1 / rates.SEK : 10.2;
  const priceMinSEK = Math.round(priceMinNOK * sekRate);
  const priceMaxSEK = Math.round(priceMaxNOK * sekRate);

  // Blocket bruker meter, ikke fot
  const meterMin = Math.round(sizeMinFt * 0.3048 * 10) / 10;
  const meterMax = Math.round(sizeMaxFt * 0.3048 * 10) / 10;

  const params = new URLSearchParams({
    q: boatType,
    cg: '5020', // Kategori: Segelbåtar
    r: 'Sverige',
    price_from: priceMinSEK,
    price_to: priceMaxSEK,
    year_from: yearMin,
  });

  return `https://www.blocket.se/annonser/hela_sverige/fritid_hobby/battar_vattensport/segelbaatar?${params}`;
}

/**
 * DBA.dk – Danmark
 * Valuta: DKK. 1 NOK ≈ 0.68 DKK... men egentlig 1 DKK ≈ 1.47 NOK
 */
export function buildDbaUrl({ boatType, yearMin, priceMinNOK, priceMaxNOK, rates }) {
  const dkkRate = rates?.DKK ? 1 / rates.DKK : 0.68;
  const priceMinDKK = Math.round(priceMinNOK * dkkRate);
  const priceMaxDKK = Math.round(priceMaxNOK * dkkRate);

  const params = new URLSearchParams({
    searchtext: `${boatType} sejlbåd`,
    pricefrom: priceMinDKK,
    priceto: priceMaxDKK,
    minyear: yearMin,
  });

  return `https://www.dba.dk/biler-og-transport/baade-og-sejlsport/sejlbaade/?${params}`;
}

/**
 * Finn.no – direkte søke-URL som backup/supplement
 */
export function buildFinnUrl({ boatType, yearMin, priceMinNOK, priceMaxNOK, sizeMinFt, sizeMaxFt }) {
  const params = new URLSearchParams({
    searchkey: 'BOAT_USED',
    q: boatType,
    price_from: priceMinNOK,
    price_to: priceMaxNOK,
    year_from: yearMin,
    'boat_length_from': sizeMinFt,
    'boat_length_to': sizeMaxFt,
  });

  return `https://www.finn.no/boat/used/search?${params}`;
}
