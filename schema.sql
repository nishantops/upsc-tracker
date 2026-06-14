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
-- DONE! Each user now gets isolated data.
-- The app sends user_id on every write, RLS filters reads automatically.
-- ============================================================================
