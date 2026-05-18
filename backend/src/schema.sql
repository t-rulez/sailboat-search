-- Kjør dette mot Railway PostgreSQL for å oppdatere schema:
-- psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS listings (
  id               SERIAL PRIMARY KEY,
  source           VARCHAR(20)  NOT NULL,
  external_id      VARCHAR(100) NOT NULL,
  url              TEXT         NOT NULL,
  title            TEXT         NOT NULL,
  brand            VARCHAR(100),
  boat_type        VARCHAR(100),
  price_nok        INTEGER,
  price_original   INTEGER,
  currency         VARCHAR(5)   DEFAULT 'NOK',
  year             INTEGER,
  length_ft        NUMERIC(5,1),
  image_url        TEXT,
  location         VARCHAR(200),
  status           VARCHAR(20)  DEFAULT 'active',
  is_favorite      BOOLEAN      DEFAULT false,
  comment          TEXT         DEFAULT NULL,
  first_seen_at    TIMESTAMPTZ  DEFAULT NOW(),
  last_checked_at  TIMESTAMPTZ  DEFAULT NOW(),
  last_changed_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(source, external_id)
);

-- Legg til kolonner hvis tabellen allerede eksisterer
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS price_history (
  id          SERIAL PRIMARY KEY,
  listing_id  INTEGER      NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price_nok   INTEGER      NOT NULL,
  recorded_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Slett favorites-tabellen hvis den finnes
DROP TABLE IF EXISTS favorites CASCADE;

-- Slett search_runs hvis den finnes (ikke lenger i bruk)
DROP TABLE IF EXISTS search_runs CASCADE;

CREATE INDEX IF NOT EXISTS idx_listings_status      ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_source      ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_price       ON listings(price_nok);
CREATE INDEX IF NOT EXISTS idx_listings_year        ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_length      ON listings(length_ft);
CREATE INDEX IF NOT EXISTS idx_listings_favorite    ON listings(is_favorite);
CREATE INDEX IF NOT EXISTS idx_price_history_lid    ON price_history(listing_id);
