import { getNumberEnv } from '@/lib/config/env';

// Election limits
export const ELECTION_TITLE_MAX_LENGTH = 255;
export const ELECTION_CHOICES_MIN = 2;
export const ELECTION_CHOICES_MAX = 20;
export const ELECTION_CHOICE_MAX_LENGTH = 100;
export const ELECTION_MAX_CLOSES_AT_DAYS = 30;

// Admin invite token limits
export const INVITE_TOKEN_LENGTH = 16;
export const INVITE_TOKEN_MAX_USAGE_MIN = 1;
export const INVITE_TOKEN_MAX_USAGE_MAX = 100;
export const INVITE_TOKEN_MAX_COUNT = 10;
export const INVITE_TOKEN_MAX_VALID_DAYS = 90;

// Cache TTLs (seconds)
export const CACHE_TTL_ELECTIONS_SECS = getNumberEnv('CACHE_TTL_ELECTIONS_SECS', 60);
export const CACHE_TTL_ADMINS_SECS = getNumberEnv('CACHE_TTL_ADMINS_SECS', 30);
export const CACHE_TTL_INVITE_TOKENS_SECS = getNumberEnv('CACHE_TTL_INVITE_TOKENS_SECS', 60);
export const CACHE_TTL_CAMPUS_GROUPS_SECS = getNumberEnv('CACHE_TTL_CAMPUS_GROUPS_SECS', 60 * 60);

// Cache keys
export const CACHE_KEY_ELECTIONS = 'cache:elections';
export const CACHE_KEY_ADMINS = 'cache:admins';
export const CACHE_KEY_INVITE_TOKENS = 'cache:invite-tokens';
export const CACHE_KEY_CAMPUS_GROUPS = 'cache:campus:groups';

// JWT
export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECS = getNumberEnv('ACCESS_TOKEN_TTL_SECS', 60 * 15); // 15 minutes
export const REFRESH_TOKEN_TTL_SECS = getNumberEnv('REFRESH_TOKEN_TTL_SECS', 60 * 60 * 24 * 7); // 7 days

// Bloom
export const BLOOM_BITS = 1_000_000;
export const BLOOM_K = 7; // number of independent hash functions (Kirsch–Mitzenmacher simulated)
export const BLOOM_RESET_INTERVAL_MS = getNumberEnv(
  'BLOOM_RESET_INTERVAL_MS',
  7 * 24 * 60 * 60 * 1_000,
); // 7 days
export const KEY_BITS = 'bloom:bits';
export const KEY_RESET_AT = 'bloom:reset_at';
export const RESET_AT_CACHE_TTL_MS = 60_000; // re-fetch at most once per minute

// Rate limiting
export const RATE_LIMIT_LOGIN_WINDOW_MS = getNumberEnv('RATE_LIMIT_LOGIN_WINDOW_MS', 60_000);
export const RATE_LIMIT_LOGIN_MAX = getNumberEnv('RATE_LIMIT_LOGIN_MAX', 10);
export const RATE_LIMIT_REFRESH_WINDOW_MS = getNumberEnv('RATE_LIMIT_REFRESH_WINDOW_MS', 60_000);
export const RATE_LIMIT_REFRESH_MAX = getNumberEnv('RATE_LIMIT_REFRESH_MAX', 20);

// UI
export const CHAR_COUNTER_THRESHOLD = 0.6;
