
-- ================================================
-- Migration 009: Spaced Repetition System
-- AdaptIQ — Phase 6.3.1
-- ================================================

-- 1. Store topics that students need to review.

CREATE TABLE spaced_repetition_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    subject_id UUID NOT NULL
        REFERENCES subjects(id) ON DELETE CASCADE,

    topic VARCHAR(150) NOT NULL,

    notes TEXT,

    -- SM-2-inspired scheduling fields.
    ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50
        CHECK (ease_factor >= 1.30 AND ease_factor <= 5.00),

    interval_days INTEGER NOT NULL DEFAULT 0
        CHECK (interval_days >= 0),

    repetitions INTEGER NOT NULL DEFAULT 0
        CHECK (repetitions >= 0),

    lapses INTEGER NOT NULL DEFAULT 0
        CHECK (lapses >= 0),

    -- Review schedule.
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_reviewed_at TIMESTAMPTZ,

    -- Allow students to pause reviews.
    status VARCHAR(15) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate topic cards per user/subject.
    UNIQUE (user_id, subject_id, topic)
);

-- 2. Store review history.

CREATE TABLE spaced_repetition_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    card_id UUID NOT NULL
        REFERENCES spaced_repetition_cards(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    -- 0 = complete blackout
    -- 1 = incorrect
    -- 2 = difficult recall
    -- 3 = correct with difficulty
    -- 4 = correct
    -- 5 = perfect recall
    quality INTEGER NOT NULL
        CHECK (quality BETWEEN 0 AND 5),

    -- Scheduling values after this review.
    ease_factor_after NUMERIC(4,2) NOT NULL
        CHECK (
            ease_factor_after >= 1.30
            AND ease_factor_after <= 5.00
        ),

    interval_days_after INTEGER NOT NULL
        CHECK (interval_days_after >= 0),

    repetitions_after INTEGER NOT NULL
        CHECK (repetitions_after >= 0),

    next_review_at TIMESTAMPTZ NOT NULL,

    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for faster review scheduling.

CREATE INDEX idx_spaced_cards_user_due
ON spaced_repetition_cards (
    user_id,
    next_review_at
)
WHERE status = 'active';

CREATE INDEX idx_spaced_cards_subject
ON spaced_repetition_cards (
    subject_id
);

CREATE INDEX idx_spaced_reviews_card
ON spaced_repetition_reviews (
    card_id,
    reviewed_at DESC
);

CREATE INDEX idx_spaced_reviews_user
ON spaced_repetition_reviews (
    user_id,
    reviewed_at DESC
);
