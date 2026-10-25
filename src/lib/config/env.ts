import { z } from 'zod';

function isTruthyEnv(envVar?: string) {
  return envVar === 'true' || envVar === '1';
}

const isCI = isTruthyEnv(process.env.CI) || isTruthyEnv(process.env.SKIP_ENV_VALIDATION);

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isPublicVar(key: string): boolean {
  return key.startsWith('NEXT_PUBLIC_');
}

function ciSafe(key: string, fallback: string): string {
  if (isCI && !isPublicVar(key)) {
    return fallback;
  }
  throw new Error(`❌ Missing environment variable: ${key}`);
}

export function getEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    return ciSafe(key, `__CI_PLACEHOLDER_${key}__`);
  }
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
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    if (isCI && !isPublicVar(key)) {
      return 0;
    }
    throw new Error(`❌ Missing number env: ${key}`);
  }

  const result = z.coerce.number().safeParse(value);
  if (!result.success) {
    throw new Error(`❌ Invalid number env: ${key}`);
  }
  return result.data;
}

export function getIntegerEnv(
  key: string,
  defaultValue: number,
  min: number,
  max?: number,
): number {
  const value = getNumberEnv(key, defaultValue);
  const schema = max === undefined ? z.int().min(min) : z.int().min(min).max(max);
  if (!schema.safeParse(value).success) {
    throw new Error(`❌ Invalid integer env: ${key}`);
  }
  return value;
}

export function getBooleanEnv(key: string, defaultValue?: boolean): boolean {
  const value = readEnv(key);

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    if (isCI && !isPublicVar(key)) {
      return false;
    }
    throw new Error(`❌ Missing boolean env: ${key}`);
  }

  const result = z.enum(['true', 'false']).safeParse(value);
  if (!result.success) {
    throw new Error(`❌ Invalid boolean env: ${key}; expected true or false`);
  }
  return result.data === 'true';
}

export function getUrlEnv(key: string, defaultValue?: string): string {
  const value = readEnv(key);
  const finalValue = value ?? defaultValue;

  if (!finalValue) {
    if (isCI && !isPublicVar(key)) {
      return 'http://localhost';
    }
    throw new Error(`❌ Missing URL env: ${key}`);
  }

  if (!z.url().safeParse(finalValue).success) {
    throw new Error(`❌ Invalid URL in env: ${key}`);
  }
  return finalValue;
}

export function getSecret(key: string, minLength = 32, maxLength?: number): string {
  const value = readEnv(key);

  if (!value) {
    return ciSafe(key, 'a'.repeat(minLength));
  }

  const schema = maxLength ? z.string().min(minLength).max(maxLength) : z.string().min(minLength);
  if (!schema.safeParse(value).success) {
    if (isCI && !isPublicVar(key)) {
      return value;
    }
    throw new Error(
      value.length < minLength
        ? `❌ ${key} must be at least ${minLength} characters long`
        : `❌ ${key} must be no longer than ${maxLength} characters`,
    );
  }

  return value;
}

export const env = {
  DATABASE_URL: getEnv('DATABASE_URL'),
  REDIS_URL: getEnv('REDIS_URL'),

  JWT_ACCESS_SECRET: getSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: getSecret('JWT_REFRESH_SECRET'),
  DATABASE_ENCRYPTION_KEY: getSecret('DATABASE_ENCRYPTION_KEY', 64, 64),

  CAMPUS_API_URL: getUrlEnv('CAMPUS_API_URL'),
  CAMPUS_INTEGRATION_API_KEY: getEnv('CAMPUS_INTEGRATION_API_KEY'),

  KPI_APP_SECRET: getEnv('KPI_APP_SECRET'),
  CRON_SECRET: getSecret('CRON_SECRET'),
  TRUSTED_PROXY_COUNT: getIntegerEnv('TRUSTED_PROXY_COUNT', 1, 0),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'production'),

  PROTOCOL_GENERATOR_URL: getUrlEnv('PROTOCOL_GENERATOR_URL'),
  PROTOCOL_TEMPLATE_ID: getEnv('PROTOCOL_TEMPLATE_ID'),

  MINIO_ENDPOINT: getEnv('MINIO_ENDPOINT'),
  MINIO_PORT: getIntegerEnv('MINIO_PORT', 9000, 1, 65535),
  MINIO_USE_SSL: getBooleanEnv('MINIO_USE_SSL', false),
  MINIO_ACCESS_KEY: getEnv('MINIO_ACCESS_KEY'),
  MINIO_SECRET_KEY: getEnv('MINIO_SECRET_KEY'),
  MINIO_PUBLIC_BUCKET: getOptionalEnv('MINIO_PUBLIC_BUCKET', 'kpistats-public'),
};
