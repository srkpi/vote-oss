// ---------------------------------------------------------------------------
// Election limits
// ---------------------------------------------------------------------------

export const ELECTION_TITLE_MAX_LENGTH = 255;
export const ELECTION_CHOICES_MIN = 2;
export const ELECTION_CHOICES_MAX = 20;
export const ELECTION_CHOICE_MAX_LENGTH = 100;

// ---------------------------------------------------------------------------
// Admin invite token limits
// ---------------------------------------------------------------------------

export const INVITE_TOKEN_MAX_USAGE_MIN = 1;
export const INVITE_TOKEN_MAX_USAGE_MAX = 100;

// ---------------------------------------------------------------------------
// Cache TTLs (seconds)
// ---------------------------------------------------------------------------

export const CACHE_TTL_ELECTIONS_SECS = 60;
export const CACHE_TTL_ADMINS_SECS = 30;

// ---------------------------------------------------------------------------
// Cache keys
// ---------------------------------------------------------------------------

export const CACHE_KEY_ELECTIONS = 'cache:elections';
export const CACHE_KEY_ADMINS = 'cache:admins';

// ---------------------------------------------------------------------------
// Campus API cache
// ---------------------------------------------------------------------------

export const CACHE_KEY_CAMPUS_GROUPS = 'cache:campus:groups';
export const CACHE_TTL_CAMPUS_GROUPS_SECS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECS = 60 * 15; // 15 minutes
export const REFRESH_TOKEN_TTL_SECS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export const RATE_LIMIT_LOGIN_WINDOW_MS = 60_000; // 1 minute
export const RATE_LIMIT_LOGIN_MAX = 10;
export const RATE_LIMIT_REFRESH_WINDOW_MS = 60_000;
export const RATE_LIMIT_REFRESH_MAX = 20;

// ---------------------------------------------------------------------------
// UI thresholds
// ---------------------------------------------------------------------------

/** Show character counter when this fraction of the limit has been used */
export const CHAR_COUNTER_THRESHOLD = 0.6;
