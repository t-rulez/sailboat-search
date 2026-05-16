-- Kjør dette én gang mot din Railway PostgreSQL-database:
-- psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS listings (
  id               SERIAL PRIMARY KEY,
  source           VARCHAR(20)  NOT NULL,          -- 'finn' | 'blocket' | 'dba'
  external_id      VARCHAR(100) NOT NULL,
  url              TEXT         NOT NULL,
  title            TEXT         NOT NULL,
  brand            VARCHAR(100),
  boat_type        VARCHAR(100),
  price_nok        INTEGER,                         -- alltid i NOK
  price_original   INTEGER,                         -- i lokal valuta
  currency         VARCHAR(5)   DEFAULT 'NOK',
  year             INTEGER,
  length_ft        NUMERIC(5,1),
  image_url        TEXT,
  location         VARCHAR(200),
  status           VARCHAR(20)  DEFAULT 'active',  -- 'active' | 'sold' | 'removed'
  first_seen_at    TIMESTAMPTZ  DEFAULT NOW(),
  last_checked_at  TIMESTAMPTZ  DEFAULT NOW(),
  last_changed_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE TABLE IF NOT EXISTS price_history (
  id          SERIAL PRIMARY KEY,
  listing_id  INTEGER      NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price_nok   INTEGER      NOT NULL,
  recorded_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id          SERIAL PRIMARY KEY,
  listing_id  INTEGER      NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(listing_id)
);

CREATE TABLE IF NOT EXISTS search_runs (
  id             SERIAL PRIMARY KEY,
  source         VARCHAR(20),
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  listings_found INTEGER     DEFAULT 0,
  error          TEXT
);

-- Indekser for raske søk
CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_source   ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(price_nok);
CREATE INDEX IF NOT EXISTS idx_listings_year     ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_length   ON listings(length_ft);
CREATE INDEX IF NOT EXISTS idx_price_history_lid ON price_history(listing_id);
