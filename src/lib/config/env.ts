function isTruthyEnv(envVar?: string) {
  return envVar === 'true' || envVar === '1';
}

const isCI = isTruthyEnv(process.env.CI) || isTruthyEnv(process.env.SKIP_ENV_VALIDATION);

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isPublicVar(key: string): boolean {
  return key.startsWith('NEXT_PUBLIC_');
}

function ciSafe(key: string, fallback: string): string {
  if (isCI && !isPublicVar(key)) return fallback;
  throw new Error(`❌ Missing environment variable: ${key}`);
}

export function getEnv(key: string): string {
  const value = readEnv(key);
  if (!value) return ciSafe(key, `__CI_PLACEHOLDER_${key}__`);
  return value;
}

export function getOptionalEnv(key: string): string | undefined;
export function getOptionalEnv(key: string, defaultValue: string): string;
export function getOptionalEnv(key: string, defaultValue?: string) {
  const value = readEnv(key);
  return value ?? defaultValue;
}

export function getNumberEnv(key: string, defaultValue?: number): number {
  const value = readEnv(key);

  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    if (isCI && !isPublicVar(key)) return 0;
    throw new Error(`❌ Missing number env: ${key}`);
  }

  const num = Number(value);
  if (Number.isNaN(num)) throw new Error(`❌ Invalid number env: ${key}`);
  return num;
}

export function getBooleanEnv(key: string, defaultValue?: boolean): boolean {
  const value = readEnv(key);

  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    if (isCI && !isPublicVar(key)) return false;
    throw new Error(`❌ Missing boolean env: ${key}`);
  }

  return value === 'true';
}

export function getUrlEnv(key: string, defaultValue?: string): string {
  const value = readEnv(key);
  const finalValue = value ?? defaultValue;

  if (!finalValue) {
    if (isCI && !isPublicVar(key)) return 'http://localhost';
    throw new Error(`❌ Missing URL env: ${key}`);
  }

  try {
    new URL(finalValue);
    return finalValue;
  } catch {
    throw new Error(`❌ Invalid URL in env: ${key}`);
  }
}

export function getSecret(key: string, minLength = 32, maxLength?: number): string {
  const value = readEnv(key);

  if (!value) return ciSafe(key, 'a'.repeat(minLength));

  if (value.length < minLength) {
    if (isCI && !isPublicVar(key)) return value;
    throw new Error(`❌ ${key} must be at least ${minLength} characters long`);
  }

  if (maxLength && value.length > maxLength) {
    if (isCI && !isPublicVar(key)) return value;
    throw new Error(`❌ ${key} must be no longer than ${maxLength} characters`);
  }

  return value;
}

export const env = {
  DATABASE_URL: getEnv('DATABASE_URL'),
  REDIS_URL: getEnv('REDIS_URL'),

  JWT_ACCESS_SECRET: getSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: getSecret('JWT_REFRESH_SECRET'),
  DATABASE_ENCRYPTION_KEY: getSecret('DATABASE_ENCRYPTION_KEY', 64, 64),

  CAMPUS_API_URL: getEnv('CAMPUS_API_URL'),
  CAMPUS_INTEGRATION_API_KEY: getEnv('CAMPUS_INTEGRATION_API_KEY'),

  KPI_APP_SECRET: getEnv('KPI_APP_SECRET'),
  CRON_SECRET: getSecret('CRON_SECRET'),
  TRUSTED_PROXY_COUNT: getNumberEnv('TRUSTED_PROXY_COUNT', 1),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'production'),
  APP_VERSION: getOptionalEnv('npm_package_version', '1.0.0'),

  PROTOCOL_GENERATOR_URL: getOptionalEnv(
    'PROTOCOL_GENERATOR_URL',
    'https://kpi-docs-generator.onrender.com/api',
  ),
  PROTOCOL_TEMPLATE_ID: getOptionalEnv(
    'PROTOCOL_TEMPLATE_ID',
    '1uRjSw17KziQQsomG8I30tvrnEv0PjM2pcDkVNwzcijw',
  ),

  MINIO_ENDPOINT: getEnv('MINIO_ENDPOINT'),
  MINIO_PORT: getNumberEnv('MINIO_PORT', 9000),
  MINIO_USE_SSL: getBooleanEnv('MINIO_USE_SSL', false),
  MINIO_ACCESS_KEY: getEnv('MINIO_ACCESS_KEY'),
  MINIO_SECRET_KEY: getEnv('MINIO_SECRET_KEY'),
  MINIO_PUBLIC_BUCKET: getOptionalEnv('MINIO_PUBLIC_BUCKET', 'kpistats-public'),
  MINIO_PUBLIC_URL_BASE: getOptionalEnv('MINIO_PUBLIC_URL_BASE'),
};
