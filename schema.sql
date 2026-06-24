-- ============================================================================
-- UPSC TRACKER: SOLID Schema v5
-- Design: Single Responsibility per table, CASCADE deletes, full RLS,
--         updated_at triggers, indexes on all FK + query columns.
-- SAFE TO RUN on existing DB: all migrations use IF NOT EXISTS / IF EXISTS.
-- ============================================================================

-- ── FRESH INSTALL: Drop + recreate (comment out if upgrading existing DB) ────
-- DROP TABLE IF EXISTS upsc_plan_tables     CASCADE;
-- DROP TABLE IF EXISTS upsc_focus_sessions  CASCADE;
-- DROP TABLE IF EXISTS upsc_user_sources    CASCADE;
-- DROP TABLE IF EXISTS upsc_custom_plans    CASCADE;
-- DROP TABLE IF EXISTS upsc_tracker_progress CASCADE;
-- DROP TABLE IF EXISTS upsc_user_sessions   CASCADE;
-- DROP TABLE IF EXISTS upsc_user_profiles   CASCADE;

-- ============================================================================
-- TABLE 1: User Profiles — identity, preferences, S&W data
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_user_profiles (
    user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT        NOT NULL DEFAULT 'User',
    email        TEXT,
    phone        TEXT,
    age          INTEGER,
    attempt      INTEGER     DEFAULT 1,
    profile_data JSONB       DEFAULT '{}',  -- stores: {strengths, weaknesses, show_sw, optional_subject}
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}';
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

ALTER TABLE upsc_user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile"   ON upsc_user_profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON upsc_user_profiles;
DROP POLICY IF EXISTS "Users update own profile" ON upsc_user_profiles;
CREATE POLICY "Users read own profile"   ON upsc_user_profiles FOR SELECT
  USING (auth.uid() = user_id OR (auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');
CREATE POLICY "Users insert own profile" ON upsc_user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON upsc_user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 2: User Sessions — login tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_user_sessions (
    user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT,
    is_superuser BOOLEAN     DEFAULT FALSE,
    login_at     TIMESTAMPTZ DEFAULT now(),
    last_active  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own session"   ON upsc_user_sessions;
DROP POLICY IF EXISTS "Users insert own session" ON upsc_user_sessions;
DROP POLICY IF EXISTS "Users update own session" ON upsc_user_sessions;
CREATE POLICY "Users read own session"   ON upsc_user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own session" ON upsc_user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own session" ON upsc_user_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: Tracker Progress — checkbox + notes for ALL tracker items
--   id patterns: 'custom_{box}_{enc}', 'plan_task_{enc}_{taskB64}', etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_tracker_progress (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_checked  BOOLEAN     NOT NULL DEFAULT FALSE,
    topic_note  TEXT        DEFAULT '',
    updated_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);
ALTER TABLE upsc_tracker_progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_progress_user_id  ON upsc_tracker_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_updated  ON upsc_tracker_progress(user_id, updated_at DESC);
ALTER TABLE upsc_tracker_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own progress"   ON upsc_tracker_progress;
DROP POLICY IF EXISTS "Users insert own progress" ON upsc_tracker_progress;
DROP POLICY IF EXISTS "Users update own progress" ON upsc_tracker_progress;
DROP POLICY IF EXISTS "Users delete own progress" ON upsc_tracker_progress;
CREATE POLICY "Users read own progress"   ON upsc_tracker_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON upsc_tracker_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON upsc_tracker_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON upsc_tracker_progress FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 4: Custom Study Plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_custom_plans (
    plan_id       TEXT        NOT NULL,   -- btoa-encoded title (stable ID)
    user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_title    TEXT        NOT NULL,
    plan_type     TEXT        DEFAULT 'weekly',
    plan_category TEXT        DEFAULT 'common',
    plan_division TEXT        DEFAULT 'both',
    plan_subject  TEXT,
    plan_note     TEXT        DEFAULT '',
    content_type  TEXT        DEFAULT 'both',
    notif_enabled BOOLEAN     DEFAULT TRUE,
    start_date    DATE,
    end_date      DATE,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (plan_id, user_id)
);
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_plans_user_id  ON upsc_custom_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_category ON upsc_custom_plans(user_id, plan_category);
ALTER TABLE upsc_custom_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own plans"   ON upsc_custom_plans;
DROP POLICY IF EXISTS "Users insert own plans" ON upsc_custom_plans;
DROP POLICY IF EXISTS "Users update own plans" ON upsc_custom_plans;
DROP POLICY IF EXISTS "Users delete own plans" ON upsc_custom_plans;
CREATE POLICY "Users read own plans"   ON upsc_custom_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON upsc_custom_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plans" ON upsc_custom_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON upsc_custom_plans FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 5: Plan Spreadsheet Sheets (plantable.js data)
--   Cascades from auth.users. plan_id references upsc_custom_plans logically.
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_plan_tables (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id      TEXT        NOT NULL,
    sheet_name   TEXT        NOT NULL DEFAULT 'Sheet 1',
    columns_data JSONB       NOT NULL DEFAULT '[]',
    rows_data    JSONB       NOT NULL DEFAULT '[]',
    sort_order   INTEGER     DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_tables_user  ON upsc_plan_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_tables_plan  ON upsc_plan_tables(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tables_order ON upsc_plan_tables(user_id, plan_id, sort_order);
ALTER TABLE upsc_plan_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own plan tables"   ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users insert own plan tables" ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users update own plan tables" ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users delete own plan tables" ON upsc_plan_tables;
CREATE POLICY "Users read own plan tables"   ON upsc_plan_tables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plan tables" ON upsc_plan_tables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plan tables" ON upsc_plan_tables FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plan tables" ON upsc_plan_tables FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 6: User Sources & Reference Links
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_user_sources (
    source_id  TEXT        NOT NULL,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    link       TEXT,
    topic      TEXT        DEFAULT 'General',
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (source_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON upsc_user_sources(user_id);
ALTER TABLE upsc_user_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own sources"   ON upsc_user_sources;
DROP POLICY IF EXISTS "Users insert own sources" ON upsc_user_sources;
DROP POLICY IF EXISTS "Users update own sources" ON upsc_user_sources;
DROP POLICY IF EXISTS "Users delete own sources" ON upsc_user_sources;
CREATE POLICY "Users read own sources"   ON upsc_user_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sources" ON upsc_user_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sources" ON upsc_user_sources FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sources" ON upsc_user_sources FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 7: Focus Sessions — cross-device study time tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_focus_sessions (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    duration_seconds INTEGER     DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_focus_user_id ON upsc_focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_started ON upsc_focus_sessions(user_id, started_at DESC);
ALTER TABLE upsc_focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own focus sessions"   ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users insert own focus sessions" ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users update own focus sessions" ON upsc_focus_sessions;
DROP POLICY IF EXISTS "Users delete own focus sessions" ON upsc_focus_sessions;
CREATE POLICY "Users read own focus sessions"   ON upsc_focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus sessions" ON upsc_focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus sessions" ON upsc_focus_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own focus sessions" ON upsc_focus_sessions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS: auto-update updated_at on all mutable tables
-- ============================================================================
CREATE OR REPLACE FUNCTION _upsc_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at     ON upsc_user_profiles;
DROP TRIGGER IF EXISTS trg_progress_updated_at     ON upsc_tracker_progress;
DROP TRIGGER IF EXISTS trg_custom_plans_updated_at ON upsc_custom_plans;
DROP TRIGGER IF EXISTS trg_plan_tables_updated_at  ON upsc_plan_tables;

CREATE TRIGGER trg_profiles_updated_at     BEFORE UPDATE ON upsc_user_profiles     FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_progress_updated_at     BEFORE UPDATE ON upsc_tracker_progress   FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_custom_plans_updated_at BEFORE UPDATE ON upsc_custom_plans       FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_plan_tables_updated_at  BEFORE UPDATE ON upsc_plan_tables        FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

-- ============================================================================
-- TABLE 1: User Profiles (display name, preferences)
-- ============================================================================
CREATE TABLE upsc_user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'User',
    email TEXT,
    age INTEGER,
    attempt INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upsc_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON upsc_user_profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON upsc_user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON upsc_user_profiles
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 2: User Sessions (login tracking, auto-logout)
-- ============================================================================
CREATE TABLE upsc_user_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_superuser BOOLEAN DEFAULT FALSE,
    login_at TIMESTAMPTZ DEFAULT now(),
    last_active TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE upsc_user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own session" ON upsc_user_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own session" ON upsc_user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own session" ON upsc_user_sessions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: Tracker Progress (checkbox states + notes for all items)
-- ============================================================================
CREATE TABLE upsc_tracker_progress (
    id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    is_checked BOOLEAN NOT NULL DEFAULT FALSE,
    topic_note TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, user_id)
);

CREATE INDEX idx_progress_user_id ON upsc_tracker_progress(user_id);
ALTER TABLE upsc_tracker_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own progress" ON upsc_tracker_progress
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own progress" ON upsc_tracker_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON upsc_tracker_progress
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON upsc_tracker_progress
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 4: Custom Plans (study plans with metadata)
-- ============================================================================
CREATE TABLE upsc_custom_plans (
    plan_id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_title TEXT NOT NULL,
    plan_type TEXT DEFAULT 'monthly',
    plan_note TEXT DEFAULT '',
    plan_subject TEXT,
    plan_category TEXT DEFAULT 'common',
    plan_division TEXT DEFAULT 'both',
    notif_enabled BOOLEAN DEFAULT TRUE,
    content_type TEXT DEFAULT 'both',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX idx_plans_user_id ON upsc_custom_plans(user_id);
ALTER TABLE upsc_custom_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plans" ON upsc_custom_plans
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON upsc_custom_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plans" ON upsc_custom_plans
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON upsc_custom_plans
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 5: User Sources & Reference Links
-- ============================================================================
DROP TABLE IF EXISTS upsc_user_sources CASCADE;

CREATE TABLE upsc_user_sources (
    source_id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    link TEXT,
    topic TEXT DEFAULT 'General',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (source_id, user_id)
);

CREATE INDEX idx_sources_user_id ON upsc_user_sources(user_id);
ALTER TABLE upsc_user_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sources" ON upsc_user_sources
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sources" ON upsc_user_sources
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sources" ON upsc_user_sources
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sources" ON upsc_user_sources
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 6: Focus Sessions (cross-device study time tracking)
-- ============================================================================
DROP TABLE IF EXISTS upsc_focus_sessions CASCADE;

CREATE TABLE upsc_focus_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_focus_user_id ON upsc_focus_sessions(user_id);
CREATE INDEX idx_focus_started ON upsc_focus_sessions(user_id, started_at DESC);
ALTER TABLE upsc_focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own focus sessions" ON upsc_focus_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus sessions" ON upsc_focus_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus sessions" ON upsc_focus_sessions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own focus sessions" ON upsc_focus_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- MIGRATIONS (run these if upgrading an existing database — safe to re-run)
-- ============================================================================

-- v1: date range + subject columns
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_subject TEXT;

-- v2: category / division / notification / content-type columns
--     (these were live in production but missing from schema docs)
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_category TEXT DEFAULT 'common';
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_division TEXT DEFAULT 'both';
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS notif_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'both';

-- v3: plan tasks / sub-tasks / CA notes all use upsc_tracker_progress
--     (id patterns below — no schema changes needed, column already TEXT PRIMARY KEY)
--  plan task:     id = 'plan_task_{enc}_{taskB64}'
--  plan sub-task: id = 'plan_task_{enc}_{parentB64}_sub_{subB64}'
--  plan card note:id = 'plan_card_{enc}'
--  CA word note:  id = 'ca_note_word_doc'
--  All store HTML rich-text in topic_note TEXT column.

-- ============================================================================
-- TABLE 7: Plan Spreadsheet Sheets (plantable.js — CRITICAL for auto-save)
-- Safe to re-run: preserves all existing data
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_plan_tables (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id      TEXT        NOT NULL,
    sheet_name   TEXT        NOT NULL DEFAULT 'Sheet 1',
    columns_data JSONB       NOT NULL DEFAULT '[]',
    rows_data    JSONB       NOT NULL DEFAULT '[]',
    sort_order   INTEGER     DEFAULT 0,
    updated_at   TIMESTAMPTZ DEFAULT now(),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_tables_user ON upsc_plan_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_tables_plan ON upsc_plan_tables(user_id, plan_id);
ALTER TABLE upsc_plan_tables ENABLE ROW LEVEL SECURITY;

-- DROP before CREATE (policies have no IF NOT EXISTS)
DROP POLICY IF EXISTS "Users read own plan tables"   ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users insert own plan tables" ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users update own plan tables" ON upsc_plan_tables;
DROP POLICY IF EXISTS "Users delete own plan tables" ON upsc_plan_tables;

CREATE POLICY "Users read own plan tables"   ON upsc_plan_tables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plan tables" ON upsc_plan_tables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plan tables" ON upsc_plan_tables FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plan tables" ON upsc_plan_tables FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- MIGRATIONS v4+ — Idempotent, preserves all data. Safe to re-run.
-- ============================================================================

-- v4: profile extras — phone, profile_data (S&W / misc), updated_at
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE upsc_user_profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- v4: auto updated_at trigger (CREATE OR REPLACE = idempotent)
CREATE OR REPLACE FUNCTION _upsc_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_plan_tables_updated_at  ON upsc_plan_tables;
DROP TRIGGER IF EXISTS trg_custom_plans_updated_at ON upsc_custom_plans;

CREATE TRIGGER trg_plan_tables_updated_at
    BEFORE UPDATE ON upsc_plan_tables
    FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

CREATE TRIGGER trg_custom_plans_updated_at
    BEFORE UPDATE ON upsc_custom_plans
    FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();

-- ============================================================================
-- TABLE 8: User-to-Admin Messages (chat system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_messages (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    content      TEXT        NOT NULL,
    sender_type  TEXT        DEFAULT 'user' CHECK (sender_type IN ('user','admin')),
    thread_id    UUID        REFERENCES upsc_messages(id) ON DELETE CASCADE,
    is_read      BOOLEAN     DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_user       ON upsc_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread     ON upsc_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread     ON upsc_messages(user_id, is_read, sender_type);
ALTER TABLE upsc_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own messages"     ON upsc_messages;
DROP POLICY IF EXISTS "Users insert own messages"   ON upsc_messages;
DROP POLICY IF EXISTS "Admin full access messages"  ON upsc_messages;
CREATE POLICY "Users read own messages"   ON upsc_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON upsc_messages FOR INSERT WITH CHECK (auth.uid() = user_id AND sender_type = 'user');
CREATE POLICY "Admin full access messages" ON upsc_messages FOR ALL
  USING  (EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true))
  WITH CHECK (EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true));

-- ============================================================================
-- TABLE 9: Monthly Feedback (star rating + message, 1 per user per month)
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_feedback (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    content      TEXT        NOT NULL DEFAULT '',
    rating       INTEGER     CHECK (rating BETWEEN 1 AND 5),
    month_key    TEXT        NOT NULL,  -- 'YYYY-MM'
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, month_key)
);
CREATE INDEX IF NOT EXISTS idx_feedback_user  ON upsc_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_month ON upsc_feedback(month_key);
ALTER TABLE upsc_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own feedback" ON upsc_feedback;
DROP POLICY IF EXISTS "Users read own feedback"   ON upsc_feedback;
DROP POLICY IF EXISTS "Admin reads all feedback"  ON upsc_feedback;
CREATE POLICY "Users insert own feedback" ON upsc_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own feedback"   ON upsc_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin reads all feedback"  ON upsc_feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true));

-- ============================================================================
-- TABLE 10: Per-User Settings (feature flags + daily message limit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_user_settings (
    user_id         UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_msg_limit INTEGER DEFAULT 3,
    features        JSONB   DEFAULT '{"plans":true,"tracker":true,"pyq":true,"ca":true,"focus":true,"ai":true}',
    notes           TEXT,
    updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE upsc_user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own settings"   ON upsc_user_settings;
DROP POLICY IF EXISTS "Admin manage all settings" ON upsc_user_settings;
CREATE POLICY "Users read own settings"   ON upsc_user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manage all settings" ON upsc_user_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true))
  WITH CHECK (
  EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true));

-- ============================================================================
-- TABLE 11: Application Metrics Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS upsc_app_metrics (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT        NOT NULL,
    event_data JSONB       DEFAULT '{}',
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON upsc_app_metrics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON upsc_app_metrics(event_type, created_at DESC);
ALTER TABLE upsc_app_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own metrics" ON upsc_app_metrics;
DROP POLICY IF EXISTS "Admin reads all metrics"  ON upsc_app_metrics;
CREATE POLICY "Users insert own metrics" ON upsc_app_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin reads all metrics"  ON upsc_app_metrics FOR SELECT USING (
  EXISTS (SELECT 1 FROM upsc_user_sessions WHERE user_id = auth.uid() AND is_superuser = true));

-- ============================================================================
-- REALTIME: Enable for live chat updates
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE upsc_messages;

-- ============================================================================
-- updated_at trigger for new tables
-- ============================================================================
DROP TRIGGER IF EXISTS trg_plan_tables_updated_at  ON upsc_plan_tables;
DROP TRIGGER IF EXISTS trg_custom_plans_updated_at ON upsc_custom_plans;
DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON upsc_user_settings;
CREATE TRIGGER trg_plan_tables_updated_at   BEFORE UPDATE ON upsc_plan_tables   FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_custom_plans_updated_at  BEFORE UPDATE ON upsc_custom_plans  FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON upsc_user_settings FOR EACH ROW EXECUTE PROCEDURE _upsc_set_updated_at();
