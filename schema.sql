-- ============================================================================
-- UPSC TRACKER: Multi-Table Schema v2
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ⚠️ This will DROP old tables. Skip DROPs if you want to preserve data.
DROP TABLE IF EXISTS upsc_custom_plans CASCADE;
DROP TABLE IF EXISTS upsc_tracker_progress CASCADE;
DROP TABLE IF EXISTS upsc_user_sessions CASCADE;
DROP TABLE IF EXISTS upsc_user_profiles CASCADE;
DROP TABLE IF EXISTS nishant_upsc_tracker CASCADE;

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
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE upsc_custom_plans ADD COLUMN IF NOT EXISTS plan_subject TEXT;
