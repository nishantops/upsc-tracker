-- Migration v9: Focus mode daily aggregation table
-- Stores ONE row per user per day with total study seconds
-- Replaces granular session history with daily totals

-- Daily focus totals (one row per user per day)
CREATE TABLE IF NOT EXISTS upsc_focus_daily (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  focus_date DATE NOT NULL,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, focus_date)
);

-- Enable RLS
ALTER TABLE upsc_focus_daily ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own daily focus"
  ON upsc_focus_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily focus"
  ON upsc_focus_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily focus"
  ON upsc_focus_daily FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily focus"
  ON upsc_focus_daily FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_focus_daily_user_date
  ON upsc_focus_daily(user_id, focus_date DESC);

-- Add accumulated_seconds to active sessions (for pause support)
ALTER TABLE upsc_focus_sessions
  ADD COLUMN IF NOT EXISTS accumulated_seconds INTEGER NOT NULL DEFAULT 0;

-- Migrate existing session data into daily totals
INSERT INTO upsc_focus_daily (user_id, focus_date, total_seconds, updated_at)
SELECT
  user_id,
  (started_at AT TIME ZONE 'Asia/Kolkata')::date AS focus_date,
  SUM(COALESCE(duration_seconds, 0)) AS total_seconds,
  now()
FROM upsc_focus_sessions
WHERE ended_at IS NOT NULL AND duration_seconds > 0
GROUP BY user_id, (started_at AT TIME ZONE 'Asia/Kolkata')::date
ON CONFLICT (user_id, focus_date)
DO UPDATE SET total_seconds = upsc_focus_daily.total_seconds + EXCLUDED.total_seconds,
             updated_at = now();

-- Clean up old completed sessions (keep only active ones for resume)
DELETE FROM upsc_focus_sessions WHERE ended_at IS NOT NULL;
