-- جدول ثبت‌نام برندها (Cloudflare D1)
CREATE TABLE IF NOT EXISTS registrations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  brand          TEXT    NOT NULL,
  contact_name   TEXT    NOT NULL,
  phone          TEXT    NOT NULL,
  product_group  TEXT    NOT NULL,
  package_choice TEXT    NOT NULL,
  prev_collab    TEXT,
  prize_support  TEXT,
  brand_url      TEXT,
  message        TEXT,
  consent        INTEGER NOT NULL DEFAULT 1,
  ip_hash        TEXT,
  user_agent     TEXT,
  status         TEXT    NOT NULL DEFAULT 'new',   -- new / contacted / confirmed / rejected
  admin_note     TEXT
);

CREATE INDEX IF NOT EXISTS idx_reg_created ON registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_reg_iphash  ON registrations(ip_hash, created_at);
