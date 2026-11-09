-- schema.sql
-- Cloudflare D1 migration for Daily Subtle Lie

CREATE TABLE IF NOT EXISTS puzzles (
  date       TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  topic      TEXT NOT NULL,
  sentences  TEXT NOT NULL,   -- JSON array of strings (lie already substituted)
  lie_index  INTEGER NOT NULL,
  truth      TEXT NOT NULL,   -- the original true sentence the lie replaced
  source_url TEXT NOT NULL,
  source_license TEXT NOT NULL DEFAULT 'CC BY-SA 4.0',
  status     TEXT NOT NULL CHECK (status IN ('review', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_puzzles_status ON puzzles(status);
CREATE INDEX IF NOT EXISTS idx_puzzles_date_status ON puzzles(date, status);

-- Hybrid pool for Categories + Random daily sets of 10
CREATE TABLE IF NOT EXISTS pool_puzzles (
  id             TEXT PRIMARY KEY,
  category       TEXT NOT NULL,
  topic          TEXT NOT NULL,
  sentences      TEXT NOT NULL,
  lie_index      INTEGER NOT NULL,
  truth          TEXT NOT NULL,
  source_url     TEXT NOT NULL,
  source_license TEXT NOT NULL DEFAULT 'CC BY-SA 4.0',
  status         TEXT NOT NULL CHECK (status IN ('review', 'approved', 'rejected')),
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pool_category_status ON pool_puzzles(category, status);
CREATE INDEX IF NOT EXISTS idx_pool_status ON pool_puzzles(status);
