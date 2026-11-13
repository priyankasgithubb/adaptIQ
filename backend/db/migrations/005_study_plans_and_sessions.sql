
CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  version INT NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, version)
);

CREATE UNIQUE INDEX study_plans_one_active_per_week_idx
  ON study_plans (user_id, week_start)
  WHERE status = 'active';

CREATE INDEX study_plans_user_week_idx
  ON study_plans (user_id, week_start DESC, version DESC);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'completed', 'partial', 'missed')),
  actual_minutes INT NOT NULL DEFAULT 0
    CHECK (actual_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (
    actual_minutes <= EXTRACT(
      EPOCH FROM (end_time - start_time)
    ) / 60
  )
);

CREATE INDEX study_sessions_plan_day_idx
  ON study_sessions (plan_id, weekday, start_time);
