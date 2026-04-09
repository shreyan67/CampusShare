require('dotenv').config()
const { pool } = require('./pool')

const SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Colleges (each college is isolated)
CREATE TABLE IF NOT EXISTS colleges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  domain      TEXT NOT NULL UNIQUE,  -- e.g. iitb.ac.in
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert some seed colleges
INSERT INTO colleges (name, domain) VALUES
  ('IIT Bombay',          'mail.iitb.ac.in'),
  ('IIT Kanpur',          'mail.iitk.ac.in'),
  ('IIT Delhi',           'mail.iitd.ac.in'),
  ('NIT Trichy',          'mail.nitt.edu'),
  ('BITS Pilani',         'mail.bits-pilani.ac.in'),
  ('IISc Bangalore',      'mail.iisc.ac.in'),
  ('VIT Vellore',         'mail.vit.ac.in'),
  ('Anna University',     'mail.annauniv.edu'),
  ('Delhi University',    'mail.du.ac.in'),
  ('Jadavpur University', 'mail.jadavpur.edu'),
  ('JIIT',                'mail.jiit.ac.in')

ON CONFLICT (domain) DO NOTHING;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    UUID NOT NULL REFERENCES colleges(id),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  roll_number   TEXT NOT NULL,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  trust_tier    TEXT NOT NULL DEFAULT 'newcomer'
                  CHECK (trust_tier IN ('newcomer','regular','trusted','rep')),
  return_count  INT NOT NULL DEFAULT 0,
  avatar        TEXT,
  color         TEXT DEFAULT '#185FA5',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTPs
CREATE TABLE IF NOT EXISTS otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items (marketplace listings)
CREATE TABLE IF NOT EXISTS items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       UUID NOT NULL REFERENCES colleges(id),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN (
                     'Books','Lab Equipment','Electronics',
                     'Notes & Guides','Accessories','Other'
                   )),
  condition_notes  TEXT DEFAULT '',
  max_borrow_days  SMALLINT NOT NULL DEFAULT 7,
  status           TEXT NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available','borrowed')),
  is_paid          BOOLEAN NOT NULL DEFAULT FALSE,
  price_per_day    NUMERIC(10,2) DEFAULT 0,
  images           TEXT[] DEFAULT '{}',  -- base64 strings
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_college  ON items(college_id);
CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_owner    ON items(owner_id);

-- Lost & Found listings
CREATE TABLE IF NOT EXISTS lost_found (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   UUID NOT NULL REFERENCES colleges(id),
  poster_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  lost_by      TEXT NOT NULL CHECK (lost_by IN ('me','someone_else')),
  location     TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','claimed','closed')),
  images       TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lf_college ON lost_found(college_id);

-- Borrow Requests
CREATE TABLE IF NOT EXISTS borrow_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  borrower_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_days  SMALLINT NOT NULL,
  message         TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending','selected','active',
                      'returned','declined','overdue'
                    )),
  total_amount    NUMERIC(10,2) DEFAULT 0,
  payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_req_borrower ON borrow_requests(borrower_id);
CREATE INDEX IF NOT EXISTS idx_req_owner    ON borrow_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_req_item     ON borrow_requests(item_id);

-- Lost & Found Claims
CREATE TABLE IF NOT EXISTS lf_claims (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lf_id        UUID NOT NULL REFERENCES lost_found(id) ON DELETE CASCADE,
  claimer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message      TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

async function setup() {
  console.log('Setting up CampusShare database...')
  try {
    await pool.query(SQL)
    console.log('✅ All tables created and colleges seeded.')
    console.log('   Next: npm run dev')
  } catch (err) {
    console.error('❌ Setup failed:', err.message)
    console.error('   Check your DATABASE_URL in .env')
  } finally {
    await pool.end()
  }
}

setup()
