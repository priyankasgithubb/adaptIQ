-- Migration 002: subjects, topics and assessment marks

CREATE TABLE subjects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  weight       NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0 AND weight <= 10),
  target_score NUMERIC(5,2) CHECK (target_score BETWEEN 0 AND 100),
  status       TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('weak', 'strong', 'unknown')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  UNIQUE (subject_id, name)
);

CREATE TABLE assessments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  marks       NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
  max_marks   NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
  confidence  INT CHECK (confidence BETWEEN 1 AND 5),
  assessed_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (marks <= max_marks)
);