import { env } from '@/lib/config/env';

export const DATABASE_URL = env.DATABASE_URL;
export const REDIS_URL = env.REDIS_URL;

export const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
export const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

export const APP_URL = env.APP_URL;
export const CAMPUS_API_URL = env.CAMPUS_API_URL;

export const KPI_APP_SECRET = env.KPI_APP_SECRET;
export const TRUSTED_PROXY_COUNT = env.TRUSTED_PROXY_COUNT;
export const NODE_ENV = env.NODE_ENV;
export const CRON_SECRET = env.CRON_SECRET;
export const APP_VERSION = env.APP_VERSION;
