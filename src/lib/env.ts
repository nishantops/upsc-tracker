export const ENV = {
  APP_NAME: 'UPSC Command Centre',
  APP_VERSION: '3.0.0',
  APP_TAGLINE: 'UPSC CSE 2027',
  DEVELOPER_NAME: 'SAN Labs',
  HEADER_AVATAR: 'SAN',

  SUPABASE_URL: 'https://wdbwnutkomemrciybezz.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_HYqlB7gJZmJ-Ni8ZywKJ_w_bNZWlGGy',

  ADMIN_EMAIL: 'admin@upsc-nishant.me',
  SUPERUSER_EMAIL: 'sanit@upsc-nishant.me',
  SUPERUSER_ALIAS: 'sanit',

  AUTO_LOGOUT_MS: 15 * 60 * 1000,

  DEFAULT_DAILY_MSG_LIMIT: 3,
  WEEKLY_FEEDBACK_DAYS: 7,
  MSG_UNREAD_POLL_MS: 120_000,

  PT_DEBOUNCE_MS: 500,
  PT_MAX_ZOOM: 2.0,
  PT_MIN_ZOOM: 0.4,

  GANTT_MAX_UNITS: 0,

  METRICS_FLUSH_MS: 10_000,

  GEMINI_API_KEY: atob('QVEuQWI4Uk42SXJYaGVFVFRXc0M0Y2ZHdzNEdm5CZGlrUThpaERBWmJKQ0NxLUtMVGNKaXc='),
  GEMINI_MODEL: 'gemini-2.5-flash',

  PRELIMS_DATE: 'May 23, 2027 09:00:00',
  MAINS_DATE: 'August 20, 2027 09:00:00',
} as const;
