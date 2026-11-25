
-- Migration 008: Adaptive Quiz System

-- 1. Subject-specific question bank
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    subject_id UUID NOT NULL
        REFERENCES subjects(id) ON DELETE CASCADE,

    topic VARCHAR(150) NOT NULL,

    question_text TEXT NOT NULL,

    options JSONB NOT NULL,

    correct_option INTEGER NOT NULL
        CHECK (correct_option BETWEEN 0 AND 3),

    difficulty VARCHAR(10) NOT NULL DEFAULT 'easy'
        CHECK (difficulty IN ('easy', 'medium', 'hard')),

    explanation TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        jsonb_typeof(options) = 'array'
        AND jsonb_array_length(options) = 4
    )
);

-- 2. Student quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    subject_id UUID NOT NULL
        REFERENCES subjects(id) ON DELETE CASCADE,

    status VARCHAR(15) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed')),

    total_questions INTEGER NOT NULL DEFAULT 0
        CHECK (total_questions >= 0),

    correct_answers INTEGER NOT NULL DEFAULT 0
        CHECK (correct_answers >= 0),

    score_percent NUMERIC(5,2)
        CHECK (score_percent BETWEEN 0 AND 100),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    CHECK (correct_answers <= total_questions)
);

-- 3. Individual question answers
CREATE TABLE quiz_attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    attempt_id UUID NOT NULL
        REFERENCES quiz_attempts(id) ON DELETE CASCADE,

    question_id UUID NOT NULL
        REFERENCES quiz_questions(id) ON DELETE CASCADE,

    selected_option INTEGER
        CHECK (selected_option BETWEEN 0 AND 3),

    is_correct BOOLEAN NOT NULL DEFAULT FALSE,

    answered_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (attempt_id, question_id)
);

-- Indexes for common quiz queries
CREATE INDEX idx_quiz_questions_subject_difficulty
    ON quiz_questions(subject_id, difficulty);

CREATE INDEX idx_quiz_attempts_user
    ON quiz_attempts(user_id, started_at DESC);

CREATE INDEX idx_quiz_attempt_answers_attempt
    ON quiz_attempt_answers(attempt_id);
