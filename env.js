// =========================================================================
// ENVIRONMENT CONFIGURATION
// All sensitive/configurable values in one place.
// Edit this file to change keys, URLs, or settings without touching app code.
// =========================================================================

const ENV = Object.freeze({
    // ── App Identity ────────────────────────────────────────────────────────
    APP_NAME:        "UPSC Command Centre",
    APP_VERSION:     "2.6.0",        // Increment to bust cache for all users
    APP_TAGLINE:     "UPSC CSE 2027",
    DEVELOPER_NAME:  "SAN Labs",
    HEADER_AVATAR:   "SAN",          // Text shown in header avatar badge

    // ── Supabase ────────────────────────────────────────────────────────────
    SUPABASE_URL:    "https://wdbwnutkomemrciybezz.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_HYqlB7gJZmJ-Ni8ZywKJ_w_bNZWlGGy",

    // ── Admin ────────────────────────────────────────────────────────────────
    ADMIN_EMAIL:     "admin@upsc-nishant.me",  // Only this email can access admin console
    SUPERUSER_EMAIL: "sanit@upsc-nishant.me",
    SUPERUSER_ALIAS: "sanit",

    // ── Session ─────────────────────────────────────────────────────────────
    AUTO_LOGOUT_MS:  15 * 60 * 1000, // 15 minutes

    // ── Messaging limits ────────────────────────────────────────────────────
    DEFAULT_DAILY_MSG_LIMIT: 3,      // Messages per day per user
    WEEKLY_FEEDBACK_DAYS:    7,      // Days between feedback prompts
    MSG_UNREAD_POLL_MS:      120000, // How often to check for unread messages (ms)

    // ── Table (spreadsheet) ─────────────────────────────────────────────────
    PT_DEBOUNCE_MS:  500,           // Autosave debounce in ms
    PT_MAX_ZOOM:     2.0,
    PT_MIN_ZOOM:     0.4,

    // ── Gantt ────────────────────────────────────────────────────────────────
    GANTT_MAX_UNITS: 0,              // 0 = unlimited; set e.g. 104 for 2-year cap

    // ── Metrics ─────────────────────────────────────────────────────────────
    METRICS_FLUSH_MS: 10000,         // Metrics batch flush interval (ms)

    // ── AI (Gemini 2.5 Flash) ────────────────────────────────────────────────
    GEMINI_API_KEY:  atob("QVEuQWI4Uk42SXJYaGVFVFRXc0M0Y2ZHdzNEdm5CZGlrUThpaERBWmJKQ0NxLUtMVGNKaXc="),
    GEMINI_MODEL:    "gemini-2.5-flash",

    // ── Exam Dates ───────────────────────────────────────────────────────────
    PRELIMS_DATE:    "May 23, 2027 09:00:00",
    MAINS_DATE:      "August 20, 2027 09:00:00"
});
