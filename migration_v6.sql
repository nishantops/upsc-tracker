-- ============================================================================
-- MIGRATION v6: SOLID schema improvements
-- Run in Supabase SQL Editor. Safe to re-run (all idempotent).
-- ============================================================================

-- ─── 1. Add plan_title column to upsc_plan_tables (human-readable) ───────────
ALTER TABLE upsc_plan_tables ADD COLUMN IF NOT EXISTS plan_title TEXT;

-- Backfill existing rows (decode base64 plan_id → plan_title)
UPDATE upsc_plan_tables
SET plan_title = CONVERT_FROM(DECODE(plan_id, 'base64'), 'UTF8')
WHERE plan_title IS NULL
  AND plan_id IS NOT NULL
  AND plan_id != 'master_sheet';

-- Master sheet gets literal title
UPDATE upsc_plan_tables
SET plan_title = 'Master Sheet'
WHERE plan_id = 'master_sheet' AND plan_title IS NULL;

-- ─── 2. Add table_type column (plan vs master) ──────────────────────────────
ALTER TABLE upsc_plan_tables ADD COLUMN IF NOT EXISTS table_type TEXT DEFAULT 'plan';
UPDATE upsc_plan_tables SET table_type = 'master' WHERE plan_id = 'master_sheet' AND table_type = 'plan';

-- ─── 3. Create index on plan_title for admin queries ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_plan_tables_title ON upsc_plan_tables(plan_title);

-- ─── 4. Fix feedback: Add UPDATE policy (needed for upsert) ──────────────────
DROP POLICY IF EXISTS "Users update own feedback" ON upsc_feedback;
CREATE POLICY "Users update own feedback" ON upsc_feedback
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 5. Admin view for all feedback ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all feedback" ON upsc_feedback;
CREATE POLICY "Admin reads all feedback" ON upsc_feedback FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ─── 6. Admin view for plan_tables (so admin can see who has what) ───────────
DROP POLICY IF EXISTS "Admin reads all plan tables" ON upsc_plan_tables;
CREATE POLICY "Admin reads all plan tables" ON upsc_plan_tables FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ─── 7. Useful admin query view (optional — for quick lookups) ───────────────
CREATE OR REPLACE VIEW admin_plan_overview AS
SELECT
  p.user_id,
  u.email,
  u.display_name,
  p.plan_id,
  p.plan_title,
  p.table_type,
  p.sheet_name,
  p.sort_order,
  jsonb_array_length(p.rows_data) AS row_count,
  jsonb_array_length(p.columns_data) AS col_count,
  p.updated_at,
  p.created_at
FROM upsc_plan_tables p
LEFT JOIN upsc_user_profiles u ON u.user_id = p.user_id
ORDER BY p.user_id, p.plan_title, p.sort_order;

-- ─── 8. Fix messages admin policy (avoid self-referencing upsc_user_sessions) ─
DROP POLICY IF EXISTS "Admin full access messages" ON upsc_messages;
CREATE POLICY "Admin full access messages" ON upsc_messages FOR ALL
  USING  ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ─── 9. Fix metrics admin policy ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin reads all metrics" ON upsc_app_metrics;
CREATE POLICY "Admin reads all metrics" ON upsc_app_metrics FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ─── 10. Fix settings admin policy ──────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manage all settings" ON upsc_user_settings;
CREATE POLICY "Admin manage all settings" ON upsc_user_settings FOR ALL
  USING  ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@upsc-nishant.me');

-- ============================================================================
-- ADMIN QUICK-REFERENCE QUERIES
-- ============================================================================

-- See all users and their plans/sheets at a glance:
-- SELECT * FROM admin_plan_overview;

-- See specific user's data:
-- SELECT * FROM admin_plan_overview WHERE email = 'user@example.com';

-- Decode any plan_id manually:
-- SELECT CONVERT_FROM(DECODE('UGh5c2ljYWwgR2VvZ3JhcGh5...', 'base64'), 'UTF8');

-- Count rows per user (check free tier usage):
-- SELECT user_id, email, COUNT(*) as sheets, SUM(row_count) as total_rows
-- FROM admin_plan_overview GROUP BY user_id, email ORDER BY total_rows DESC;
