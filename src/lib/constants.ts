// Election limits
export const ELECTION_TITLE_MAX_LENGTH = 255;
export const ELECTION_CHOICES_MIN = 2;
export const ELECTION_CHOICES_MAX = 20;
export const ELECTION_CHOICE_MAX_LENGTH = 100;
export const ELECTION_MAX_CLOSES_AT_DAYS = 30;
export const ELECTION_MIN_CHOICES_MIN = 1;
export const ELECTION_MAX_CHOICES_MAX = 20;

// Admin invite token limits
export const INVITE_TOKEN_LENGTH = 16;
export const INVITE_TOKEN_MAX_USAGE_MIN = 1;
export const INVITE_TOKEN_MAX_USAGE_MAX = 100;
export const INVITE_TOKEN_MAX_COUNT = 10;
export const INVITE_TOKEN_MAX_VALID_DAYS = 90;

export const BYPASS_TOKEN_LENGTH = 24;
export const BYPASS_TOKEN_MIN_HOURS = 1;
export const BYPASS_TOKEN_MAX_DAYS = 30;
export const BYPASS_TOKEN_MAX_COUNT = 100;
export const BYPASS_TOKEN_MAX_USAGE_MAX = 100;

/** Maximum days a session stays valid without a fresh Diia re-authentication */
export const SESSION_INITIAL_AUTH_MAX_DAYS = 30;

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
export const CACHE_TTL_BYPASS_SECS = 5 * 60;

// Cache keys
export const CACHE_KEY_ELECTIONS = 'cache:elections';
export const CACHE_KEY_ADMINS = 'cache:admins';
export const CACHE_KEY_INVITE_TOKENS = 'cache:invite-tokens';
export const CACHE_KEY_CAMPUS_GROUPS = 'cache:campus:groups';
export const CACHE_KEY_FAQ = 'cache:faq';
export const LOCAL_STORAGE_VOTE_KEY_PREFIX = 'vote_';
export const SESSION_USER_KEY = 'session_user_id';
export const CONFETTI_KEY_PREFIX = 'election_confetti_shown_';

// JWT
export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';
export const COOKIE_RETURN_TO = 'return_to';
export const COOKIE_PENDING_BYPASS = 'pending_bypass';

export const ACCESS_TOKEN_TTL_SECS = 60 * 15; // 15 minutes
export const REFRESH_TOKEN_TTL_SECS = 60 * 60 * 24 * 7; // 7 days
export const RETURN_COOKIE_TTL_SECS = 60 * 10; // 10 minutes

// Bloom
export const BLOOM_BITS = 1_000_000;
export const BLOOM_K = 7;
export const BLOOM_RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1_000;
export const KEY_BITS = 'bloom:bits';
export const KEY_RESET_AT = 'bloom:reset_at';
export const RESET_AT_CACHE_TTL_MS = 60_000;

// Rate limiting
export const RATE_LIMIT_LOGIN_WINDOW_MS = 60_000;
export const RATE_LIMIT_LOGIN_MAX = 10;
export const RATE_LIMIT_REFRESH_WINDOW_MS = 60_000;
export const RATE_LIMIT_REFRESH_MAX = 20;
export const RATE_LIMIT_INVITE_WINDOW_MS = 60_000;
export const RATE_LIMIT_INVITE_MAX = 20;

// DIIA auth
export const DIIA_POLL_INTERVAL_MS = 5_000;
export const DIIA_LINK_TTL_MS = 2 * 60 * 1_000;

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
export const UI_STUDY_FORMS = ['FullTime', 'Remote', 'Correspondence', 'Shortened'] as const;

export type StudyFormValue = (typeof STUDY_FORMS)[number];

export const STUDY_FORM_LABELS: Record<StudyFormValue, string> = {
  None: 'Не вказано',
  Evening: 'Вечірня',
  FullTime: 'Денна',
  Remote: 'Дистанційна',
  Extern: 'Екстернат',
  Correspondence: 'Заочна',
  Shortened: 'Прискореники',
  OutOfPostgraduate: 'Поза аспірантурою',
  Other: 'Інше',
};

export const STUDY_YEARS = [1, 2, 3, 4, 5, 6, 7] as const;
export type StudyYearValue = (typeof STUDY_YEARS)[number];

// Level/Course restriction
export const LEVEL_COURSE_BACHELOR_COURSES = [1, 2, 3, 4] as const;
export const LEVEL_COURSE_MASTER_COURSES = [1, 2] as const;
export const LEVEL_COURSE_GRADUATE_COURSES = [1, 2, 3, 4] as const;

export const LEVEL_COURSE_LEVEL_KEYS = ['b', 'm', 'g'] as const;
export type LevelCourseLevel = (typeof LEVEL_COURSE_LEVEL_KEYS)[number];

export const VALID_LEVEL_COURSES: string[] = [
  ...LEVEL_COURSE_BACHELOR_COURSES.map((c) => `b${c}`),
  ...LEVEL_COURSE_MASTER_COURSES.map((c) => `m${c}`),
  ...LEVEL_COURSE_GRADUATE_COURSES.map((c) => `g${c}`),
];

export const LEVEL_COURSE_LEVEL_LABELS: Record<LevelCourseLevel, string> = {
  b: 'Бакалаври',
  m: 'Магістри',
  g: 'Аспіранти',
};

export const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  FACULTY: 'Підрозділ',
  GROUP: 'Група',
  STUDY_YEAR: 'Рік навчання',
  STUDY_FORM: 'Форма навчання',
  SPECIALITY: 'Спеціальність',
  LEVEL_COURSE: 'Рівень та курс',
};
