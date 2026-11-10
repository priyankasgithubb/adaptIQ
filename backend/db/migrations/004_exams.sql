-- Migration 004: exams and deadlines

CREATE TABLE exams (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  exam_at        TIMESTAMPTZ NOT NULL,
  importance     NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (importance BETWEEN 0 AND 1),
  syllabus_scope TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exams_user_date_idx ON exams (user_id, exam_at);