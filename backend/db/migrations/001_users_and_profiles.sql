-- Migration 001: accounts and learner profiles
-- Runs once. Never edit this file after it has run. Make 002_... for changes.

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE learner_profiles (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  education_level        TEXT NOT NULL CHECK (education_level IN ('school', 'college', 'university')),
  year_or_class          TEXT,
  semester               TEXT,
  timezone               TEXT NOT NULL DEFAULT 'UTC',
  study_goal             TEXT,
  desired_grade          TEXT,
  preferred_session_min  INT NOT NULL DEFAULT 45 CHECK (preferred_session_min BETWEEN 15 AND 180),
  daily_study_limit_min  INT NOT NULL DEFAULT 240 CHECK (daily_study_limit_min BETWEEN 30 AND 720),
  sleep_start            TEXT,
  sleep_end              TEXT,
  break_preferences      JSONB,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);