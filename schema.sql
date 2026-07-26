-- D1 schema for the `discdrop-alerts` database (binding: DB).
-- Not run automatically — apply with:
--   npx wrangler d1 execute discdrop-alerts --remote --file=schema.sql   (production)
--   npx wrangler d1 execute discdrop-alerts --local --file=schema.sql    (local dev, for `wrangler pages dev`)
-- Written to document what's already deployed; tables already exist in production.

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  disc_id TEXT NOT NULL,
  email TEXT NOT NULL,
  target_price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  triggered_at TEXT
);

-- AI-generated bags from /bag/build, so a shared /bag/[id] link resolves on
-- any device instead of only the browser that generated it (localStorage-only).
CREATE TABLE IF NOT EXISTS bags (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
