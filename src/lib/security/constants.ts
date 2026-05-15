export const SECURITY = {
  RATE: {
    TRUST_SEARCH_PER_MIN: 30, TRUST_SEARCH_ANON_PER_MIN: 10,
    AUTH_PER_15MIN: 5, SIGNUP_PER_HOUR: 5,
    GENERIC_API_PER_MIN: 100, HEALTH_PER_MIN: 30,
    CANARY_WEBHOOK_PER_MIN: 60,
  },
  BAN: { HONEYPOT_MINUTES: 60*24*7, INJECTION_MINUTES: 60*24, FAILED_AUTH_MINUTES: 60, SCRAPER_MINUTES: 60*24 },
  AUTH: { LOCKOUT_THRESHOLD: 5, LOCKOUT_WINDOW_MIN: 15 },
  ADMIN: { SESSION_TTL_MIN: 60, REPIN_AFTER_MIN: 30 },
  GPS: { MAX_SPEED_MPH: 85, MAX_ACCEL_MPS2: 12, MAX_ACCURACY_M: 500, TELEPORT_DIST_MI: 5, TELEPORT_DT_SEC: 30 },
  TRUST: { SCORE_SWING_THRESHOLD: 15, HIGH_SCORE_FLOOR: 85, MIN_EVIDENCE_FOR_HIGH: 3 },
  SENTINEL: { START: '<<<EVIDENCE_START', END: '<<<EVIDENCE_END>>>' },
  ALERT_DEDUP_INTERVAL_SEC: 900,
  RESOLUTION_NOTE_MAX_CHARS: 500,
} as const;

export const HONEYPOT_PATHS = [
  '/.env','/.env.production','/.env.local','/.git/config',
  '/wp-admin','/wp-login.php','/admin.php','/phpmyadmin',
  '/api/v1/admin/users','/api/v1/admin/keys','/api/internal/pricing','/api/internal/keys',
  '/.aws/credentials','/config.json','/backup.sql','/_next/data/admin.json',
] as const;

export const SECURITY_RULE_KEY_PREFIXES = ['canary.','honeypot.','injection.','gps.','auth.','rls.','trust.'] as const;
