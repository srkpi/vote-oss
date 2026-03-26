// Election limits
export const ELECTION_TITLE_MAX_LENGTH = 255;
export const ELECTION_CHOICES_MIN = 2;
export const ELECTION_CHOICES_MAX = 20;
export const ELECTION_CHOICE_MAX_LENGTH = 100;
export const ELECTION_MAX_CLOSES_AT_DAYS = 30;
export const ELECTION_MIN_CHOICES_MIN = 1;
export const ELECTION_MAX_CHOICES_MAX = 4;

// Admin invite token limits
export const INVITE_TOKEN_LENGTH = 16;
export const INVITE_TOKEN_MAX_USAGE_MIN = 1;
export const INVITE_TOKEN_MAX_USAGE_MAX = 100;
export const INVITE_TOKEN_MAX_COUNT = 10;
export const INVITE_TOKEN_MAX_VALID_DAYS = 90;

// FAQ limits
export const FAQ_CATEGORY_TITLE_MAX_LENGTH = 32;
export const FAQ_ITEM_TITLE_MAX_LENGTH = 128;
export const FAQ_ITEM_CONTENT_MAX_LENGTH = 2048;

// Cache TTLs (seconds)
export const CACHE_TTL_ELECTIONS_SECS = 5 * 60;
export const CACHE_TTL_ADMINS_SECS = 5 * 60;
export const CACHE_TTL_INVITE_TOKENS_SECS = 5 * 60;
export const CACHE_TTL_CAMPUS_GROUPS_SECS = 60 * 60;
export const CACHE_TTL_FAQ_SECS = 5 * 60;

// Cache keys
export const CACHE_KEY_ELECTIONS = 'cache:elections';
export const CACHE_KEY_ADMINS = 'cache:admins';
export const CACHE_KEY_INVITE_TOKENS = 'cache:invite-tokens';
export const CACHE_KEY_CAMPUS_GROUPS = 'cache:campus:groups';
export const CACHE_KEY_FAQ = 'cache:faq';
export const LOCAL_STORAGE_VOTE_KEY_PREFIX = 'vote_';

// JWT
export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECS = 60 * 15; // 15 minutes
export const REFRESH_TOKEN_TTL_SECS = 60 * 60 * 24 * 7; // 7 days

// Bloom
export const BLOOM_BITS = 1_000_000;
export const BLOOM_K = 7; // number of independent hash functions (Kirsch–Mitzenmacher simulated)
export const BLOOM_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
export const KEY_BITS = 'bloom:bits';
export const KEY_RESET_AT = 'bloom:reset_at';
export const RESET_AT_CACHE_TTL_MS = 60_000; // re-fetch at most once per minute

// Rate limiting
export const RATE_LIMIT_LOGIN_WINDOW_MS = 60_000;
export const RATE_LIMIT_LOGIN_MAX = 10;
export const RATE_LIMIT_REFRESH_WINDOW_MS = 60_000;
export const RATE_LIMIT_REFRESH_MAX = 20;

// UI
export const CHAR_COUNTER_THRESHOLD = 0.6;

// Study restrictions
export const STUDY_FORMS = [
  'None',
  'Evening',
  'FullTime',
  'Remote',
  'Extern',
  'Correspondence',
  'Shortened',
  'OutOfPostgraduate',
  'Other',
] as const;
export type StudyFormValue = (typeof STUDY_FORMS)[number];

export const STUDY_FORM_LABELS: Record<StudyFormValue, string> = {
  None: 'Не вказано',
  Evening: 'Вечірня',
  FullTime: 'Денна',
  Remote: 'Дистанційна',
  Extern: 'Екстернат',
  Correspondence: 'Заочна',
  Shortened: 'Скорочена',
  OutOfPostgraduate: 'Поза аспірантурою',
  Other: 'Інша',
};

export const STUDY_YEARS = [1, 2, 3, 4, 5, 6, 7] as const;
export type StudyYearValue = (typeof STUDY_YEARS)[number];

export const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  FACULTY: 'Факультет',
  GROUP: 'Група',
  STUDY_YEAR: 'Рік навчання',
  STUDY_FORM: 'Форма навчання',
  SPECIALITY: 'Спеціальність',
};
