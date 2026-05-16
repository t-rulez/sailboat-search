# ⛵ Båtsøk — Seilbåtsøk i Skandinavia

PWA-app for å søke etter brukte seilbåter på Finn.no, med direkte lenker til Blocket.se og DBA.dk.

## Funksjoner

- 🔍 Live søk mot Finn.no sitt JSON-API
- 💱 Live valutaomregning (SEK/DKK → NOK) via frankfurter.app
- 🔗 Ferdig-filtrerte lenker til Blocket.se og DBA.dk
- 📱 PWA – kan legges til som app på iOS hjemskjerm
- 🌙 Nautisk mørkt design
- ↕️ Sortering på pris, årsmodell og størrelse

## Mappestruktur

```
sailboat-search/
├── public/
│   ├── manifest.json        # PWA-manifest
│   └── icons/
│       ├── favicon.svg      # SVG-ikon
│       ├── icon-192.png     # App-ikon (generer selv, se under)
│       └── icon-512.png     # App-ikon stor
├── src/
│   ├── App.jsx              # Rot-komponent
│   ├── main.jsx             # Entry point
│   ├── index.css            # Global CSS (nautisk tema)
│   ├── components/
│   │   ├── SearchForm.jsx   # Søkeskjema
│   │   ├── ResultCard.jsx   # Båt-kort
│   │   ├── ResultList.jsx   # Resultatliste + sortering
│   │   └── ExternalLinks.jsx # Blocket/DBA-lenker
│   ├── hooks/
│   │   └── useBoatSearch.js # Finn.no API-kall
│   └── utils/
│       ├── currency.js      # Valutaomregning
│       └── externalLinks.js # URL-byggere for Blocket/DBA
├── generate-icons.js        # Valgfritt: generer PNG-ikoner
├── index.html               # HTML med PWA-meta
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json              # Vercel-konfig
└── package.json
```

---

## Kom i gang lokalt

```bash
# 1. Installer avhengigheter
npm install

# 2. Kjør lokalt
npm run dev

# 3. Åpne http://localhost:3000
```

---

## Generer app-ikoner (PNG)

PWA trenger PNG-ikoner. Enkleste måte:

**Alternativ A – Online konverter (anbefalt):**
1. Gå til https://realfavicongenerator.net
2. Last opp `public/icons/favicon.svg`
3. Last ned og legg `icon-192x192.png` → `public/icons/icon-192.png`
4. Last ned og legg `icon-512x512.png` → `public/icons/icon-512.png`

**Alternativ B – Node.js script:**
```bash
npm install canvas --save-dev
node generate-icons.js
```

---

## Deploy til Vercel

### Alternativ 1 – Via GitHub (anbefalt)

1. Push koden til et GitHub-repo:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DITT_BRUKERNAVN/baatsok.git
git push -u origin main
```

2. Gå til https://vercel.com → "Add New Project"
3. Velg GitHub-repoet
4. Vercel oppdager Vite automatisk
5. Klikk "Deploy" — ferdig! Du får en URL som `baatsok.vercel.app`

### Alternativ 2 – Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## Legg til på iOS hjemskjerm (PWA)

1. Åpne appen i **Safari** på iPhone (ikke Chrome!)
2. Trykk **Del-knappen** (firkant med pil opp)
3. Velg **"Legg til på hjemskjerm"**
4. Gi den et navn (f.eks. «Båtsøk») og trykk "Legg til"

Appen åpner da i fullskjerm uten nettleserverktøylinje, akkurat som en native app.

> ⚠️ Må åpnes i Safari – Chrome støtter ikke PWA-installasjon på iOS.

---

## Teknisk: Finn.no API

Appen bruker Finn.no sitt udokumenterte, men åpne søke-API:

```
https://www.finn.no/api/search-qf?searchkey=BOAT_USED&q=katamaran&price_from=3000000&...
```

Siden Finn.no blokkerer direkte nettleser-kall med CORS, bruker appen
`api.allorigins.win` som CORS-proxy. Dette er en gratis offentlig tjeneste.

> 💡 Hvis du oppretter en backend (steg 2), kan API-kallene gå gjennom
> din egen server og du slipper den eksterne proxyen.

---

## Valutakurser

Live kurser hentes fra [frankfurter.app](https://www.frankfurter.app) (gratis, ingen API-nøkkel):

```
https://api.frankfurter.app/latest?from=NOK&to=SEK,DKK
```

Kursene caches i 1 time. Hvis API er nede, brukes statiske fallback-kurser.

---

## Neste steg (backend)

Når du er klar for å legge til varsler og lagring:
- **Backend**: Node.js/Express på Railway
- **Database**: PostgreSQL (Railway tilbyr gratis tier)
- **Cron**: node-cron kjører søk hver 30. minutt
- **Varsler**: Web Push API (fungerer på iOS 16.4+ fra hjemskjerm)
