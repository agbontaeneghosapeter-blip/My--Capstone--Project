PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0 AND sold <= capacity),
  FOREIGN KEY (event_id) REFERENCES events(id),
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  tier_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'checked_in')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id)
);
