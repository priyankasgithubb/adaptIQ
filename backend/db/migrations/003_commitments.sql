-- Migration 003: weekly commitments (classes, fixed activities, blocked times, free windows)

CREATE TABLE commitments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('class', 'fixed', 'blocked', 'free')),
  title       TEXT NOT NULL,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Monday ... 6 = Sunday
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

-- An index makes "find everything for this user on this day" fast.
CREATE INDEX commitments_user_day_idx ON commitments (user_id, weekday);