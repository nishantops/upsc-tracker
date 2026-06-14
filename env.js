// =========================================================================
// ENVIRONMENT CONFIGURATION
// All sensitive/configurable values in one place.
// Edit this file to change keys, URLs, or settings without touching app code.
// =========================================================================

const ENV = Object.freeze({
    // App Version (increment to bust cache for all users)
    APP_VERSION: "2.1.0",

    // Supabase
    SUPABASE_URL: "https://wdbwnutkomemrciybezz.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_HYqlB7gJZmJ-Ni8ZywKJ_w_bNZWlGGy",

    // Superuser
    SUPERUSER_EMAIL: "sanit@upsc-nishant.me",
    SUPERUSER_ALIAS: "sanit",

    // Session
    AUTO_LOGOUT_MS: 15 * 60 * 1000, // 15 minutes

    // AI (Gemini 2.5 Flash - best free tier: 500 RPD, 15 RPM)
    GEMINI_API_KEY: atob("QVEuQWI4Uk42SXJYaGVFVFRXc0M0Y2ZHdzNEdm5CZGlrUThpaERBWmJKQ0NxLUtMVGNKaXc="),
    GEMINI_MODEL: "gemini-2.5-flash",

    // Exam Dates
    PRELIMS_DATE: "May 23, 2027 09:00:00",
    MAINS_DATE: "August 20, 2027 09:00:00"
});
