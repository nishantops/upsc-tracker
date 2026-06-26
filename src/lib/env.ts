// =============================================================================
// Environment configuration — reads from import.meta.env (Vite .env file).
// All VITE_* variables must be defined in .env (gitignored).
// See .env.example for the full list of required variables.
// Falls back to safe defaults so the app still builds without a .env file.
// =============================================================================

const e = import.meta.env;

/** Parse a numeric env var; return `fallback` if missing or NaN. */
function num(key: string, fallback: number): number {
  const v = Number(e[key]);
  return Number.isFinite(v) ? v : fallback;
}

/** Read a string env var; return `fallback` if empty/undefined. */
function str(key: string, fallback: string): string {
  return e[key] || fallback;
}

export const ENV = {
  // ── App Identity ──────────────────────────────────────────────────────────
  APP_NAME:        str('VITE_APP_NAME',       'UPSC Command Centre'),
  APP_VERSION:     str('VITE_APP_VERSION',    '3.0.0'),
  APP_TAGLINE:     str('VITE_APP_TAGLINE',    'UPSC CSE 2027'),
  DEVELOPER_NAME:  str('VITE_DEVELOPER_NAME', 'SAN Labs'),
  HEADER_AVATAR:   str('VITE_HEADER_AVATAR',  'SAN'),

  // ── Supabase ──────────────────────────────────────────────────────────────
  SUPABASE_URL:      str('VITE_SUPABASE_URL',      ''),
  SUPABASE_ANON_KEY: str('VITE_SUPABASE_ANON_KEY', ''),

  // ── Admin / Auth ──────────────────────────────────────────────────────────
  ADMIN_EMAIL:      str('VITE_ADMIN_EMAIL',      'admin@upsc-nishant.me'),
  SUPERUSER_EMAIL:  str('VITE_SUPERUSER_EMAIL',  'sanit@upsc-nishant.me'),
  SUPERUSER_ALIAS:  str('VITE_SUPERUSER_ALIAS',  'sanit'),

  // ── Session ───────────────────────────────────────────────────────────────
  AUTO_LOGOUT_MS:           num('VITE_AUTO_LOGOUT_MS',            15 * 60 * 1000),
  SESSION_CHECK_INTERVAL_MS: num('VITE_SESSION_CHECK_INTERVAL_MS', 2 * 60 * 1000),

  // ── Messaging ─────────────────────────────────────────────────────────────
  DEFAULT_DAILY_MSG_LIMIT: num('VITE_DEFAULT_DAILY_MSG_LIMIT', 3),
  WEEKLY_FEEDBACK_DAYS:    num('VITE_WEEKLY_FEEDBACK_DAYS',    7),
  MSG_UNREAD_POLL_MS:      num('VITE_MSG_UNREAD_POLL_MS',      120_000),

  // ── Plan Table ────────────────────────────────────────────────────────────
  PT_DEBOUNCE_MS: num('VITE_PT_DEBOUNCE_MS', 500),
  PT_MAX_ZOOM:    num('VITE_PT_MAX_ZOOM',    2.0),
  PT_MIN_ZOOM:    num('VITE_PT_MIN_ZOOM',    0.4),

  // ── Gantt ─────────────────────────────────────────────────────────────────
  GANTT_MAX_UNITS: num('VITE_GANTT_MAX_UNITS', 0),

  // ── Metrics ───────────────────────────────────────────────────────────────
  METRICS_FLUSH_MS: num('VITE_METRICS_FLUSH_MS', 10_000),

  // ── AI ────────────────────────────────────────────────────────────────────
  GEMINI_API_KEY:       str('VITE_GEMINI_API_KEY',       ''),
  GEMINI_MODEL:         str('VITE_GEMINI_MODEL',         'gemini-2.5-flash'),
  GEMINI_BASE_URL:      str('VITE_GEMINI_BASE_URL',      'https://generativelanguage.googleapis.com/v1beta/models'),
  AI_HISTORY_LIMIT:     num('VITE_AI_HISTORY_LIMIT',     50),   // max messages persisted in localStorage
  AI_CONTEXT_WINDOW:    num('VITE_AI_CONTEXT_WINDOW',    10),   // last N messages sent as context per request
  AI_MAX_OUTPUT_TOKENS: num('VITE_AI_MAX_OUTPUT_TOKENS', 800),
  AI_TEMPERATURE:       num('VITE_AI_TEMPERATURE',       0.7),

  // ── Plan Grid (react-grid-layout) ─────────────────────────────────────────
  PLAN_GRID_COLS:           num('VITE_PLAN_GRID_COLS',           24),
  PLAN_CARD_DEFAULT_W:      num('VITE_PLAN_CARD_DEFAULT_W',      8),   // 8/24 = same visual as old 4/12
  PLAN_CARD_DEFAULT_H:      num('VITE_PLAN_CARD_DEFAULT_H',      2),
  PLAN_CARD_MIN_W:          num('VITE_PLAN_CARD_MIN_W',          2),
  PLAN_CARD_MIN_H:          num('VITE_PLAN_CARD_MIN_H',          2),
  PLAN_ROW_HEIGHT:          num('VITE_PLAN_ROW_HEIGHT',          68),  // px per row unit
  PLAN_GRID_MARGIN:         num('VITE_PLAN_GRID_MARGIN',         12),  // px gap between cards
  PLAN_LAYOUT_DEBOUNCE_MS:  num('VITE_PLAN_LAYOUT_DEBOUNCE_MS',  600),
  PLAN_LAYOUT_DB_TABLE:     str('VITE_PLAN_LAYOUT_DB_TABLE',     'upsc_plan_layouts'),
  PLAN_LAYOUT_LS_KEY:       str('VITE_PLAN_LAYOUT_LS_KEY',       'plan-grid-layouts-v2'),

  // ── Source Grid (react-grid-layout, all-sides resize, DB-persisted) ─────────────
  SOURCE_GRID_COLS:          num('VITE_SOURCE_GRID_COLS',          12),
  SOURCE_CARD_DEFAULT_W:     num('VITE_SOURCE_CARD_DEFAULT_W',     3),
  SOURCE_CARD_DEFAULT_H:     num('VITE_SOURCE_CARD_DEFAULT_H',     3),
  SOURCE_CARD_MIN_W:         num('VITE_SOURCE_CARD_MIN_W',         1),
  SOURCE_CARD_MIN_H:         num('VITE_SOURCE_CARD_MIN_H',         1),
  SOURCE_ROW_HEIGHT:         num('VITE_SOURCE_ROW_HEIGHT',         60),
  SOURCE_GRID_MARGIN:        num('VITE_SOURCE_GRID_MARGIN',        8),
  SOURCE_LAYOUT_DEBOUNCE_MS: num('VITE_SOURCE_LAYOUT_DEBOUNCE_MS', 600),
  SOURCE_LAYOUT_DB_TABLE:    str('VITE_SOURCE_LAYOUT_DB_TABLE',    'upsc_source_layouts'),

  // ── Pie Grid (react-grid-layout) ──────────────────────────────────────────
  PIE_GRID_COLS:           num('VITE_PIE_GRID_COLS',           5),
  PIE_ROW_HEIGHT:          num('VITE_PIE_ROW_HEIGHT',          90),  // px per row unit
  PIE_GRID_MARGIN:         num('VITE_PIE_GRID_MARGIN',         12),  // px gap between cards
  PIE_LAYOUT_DB_TABLE:     str('VITE_PIE_LAYOUT_DB_TABLE',     'upsc_pie_card_layouts'),
  PIE_LAYOUT_LS_KEY:       str('VITE_PIE_LAYOUT_LS_KEY',       'pie-matrix-layouts-v4'),

  // ── Cache TTLs ────────────────────────────────────────────────────────────
  TRACKER_CACHE_TTL_MS: num('VITE_TRACKER_CACHE_TTL_MS', 60_000), // 60 s SWR cache for tracker progress
  PLANS_CACHE_TTL_MS:   num('VITE_PLANS_CACHE_TTL_MS',   30_000), // 30 s SWR cache for plans list

  // ── Exam Dates ────────────────────────────────────────────────────────────
  PRELIMS_DATE: str('VITE_PRELIMS_DATE', 'May 23, 2027 09:00:00'),
  MAINS_DATE:   str('VITE_MAINS_DATE',   'August 20, 2027 09:00:00'),
} as const;
