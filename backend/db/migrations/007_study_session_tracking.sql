
-- Migration 007: Stable study session tracking
-- across timetable versions.
--
-- Each new logical session receives a tracking ID.
-- Copies of the same session retain that ID.
--
-- Existing sessions receive separate tracking IDs.
-- Earlier copied sessions cannot be reliably
-- linked retrospectively without more evidence.

ALTER TABLE study_sessions
ADD COLUMN tracking_id UUID;

UPDATE study_sessions
SET tracking_id = gen_random_uuid()
WHERE tracking_id IS NULL;

ALTER TABLE study_sessions
ALTER COLUMN tracking_id
SET DEFAULT gen_random_uuid();

ALTER TABLE study_sessions
ALTER COLUMN tracking_id
SET NOT NULL;

CREATE INDEX study_sessions_tracking_idx
ON study_sessions (tracking_id);
