
-- Migration 006: Persist unfinished study minutes
-- across timetable revisions.

CREATE TABLE study_plan_backlogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    plan_id UUID NOT NULL
        REFERENCES study_plans(id)
        ON DELETE CASCADE,

    subject_id UUID NOT NULL
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    remaining_minutes INT NOT NULL DEFAULT 0
        CHECK (remaining_minutes >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (plan_id, subject_id)
);

CREATE INDEX study_plan_backlogs_plan_idx
    ON study_plan_backlogs(plan_id);
