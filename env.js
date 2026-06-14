// =========================================================================
// ENVIRONMENT CONFIGURATION
// All sensitive/configurable values in one place.
// Edit this file to change keys, URLs, or settings without touching app code.
// =========================================================================

const ENV = Object.freeze({
    // Supabase
    SUPABASE_URL: "https://wdbwnutkomemrciybezz.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_HYqlB7gJZmJ-Ni8ZywKJ_w_bNZWlGGy",

    // Superuser
    SUPERUSER_EMAIL: "sanit@upsc-admin.local",
    SUPERUSER_ALIAS: "sanit",

    // Session
    AUTO_LOGOUT_MS: 15 * 60 * 1000, // 15 minutes

    // AI (Gemini) - encoded at rest, decoded at runtime
    GEMINI_API_KEY: atob("QVEuQWI4Uk42SXJYaGVFVFRXc0M0Y2ZHdzNEdm5CZGlrUThpaERBWmJKQ0NxLUtMVGNKaXc="),

    // Exam Dates
    PRELIMS_DATE: "May 23, 2027 09:00:00",
    MAINS_DATE: "August 20, 2027 09:00:00"
});
