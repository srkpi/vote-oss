function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function getEnv(key: string): string {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`❌ Missing environment variable: ${key}`);
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
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`❌ Missing number env: ${key}`);
  }

  const num = Number(value);

  if (Number.isNaN(num)) {
    throw new Error(`❌ Invalid number env: ${key}`);
  }

  return num;
}

export function getBooleanEnv(key: string, defaultValue?: boolean): boolean {
  const value = readEnv(key);

  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`❌ Missing boolean env: ${key}`);
  }

  return value === 'true';
}

export function getUrlEnv(key: string, defaultValue?: string): string {
  const value = readEnv(key);

  const finalValue = value ?? (defaultValue !== undefined ? defaultValue : undefined);

  if (!finalValue) {
    throw new Error(`❌ Missing URL env: ${key}`);
  }

  try {
    new URL(finalValue);
    return finalValue;
  } catch {
    throw new Error(`❌ Invalid URL in env: ${key}`);
  }
}

export function getSecret(key: string, minLength = 32): string {
  const value = getEnv(key);

  if (value.length < minLength) {
    throw new Error(`❌ ${key} must be at least ${minLength} characters long`);
  }

  return value;
}

export const env = {
  NEXT_PUBLIC_APP_NAME: getOptionalEnv('NEXT_PUBLIC_APP_NAME', 'Vote OSS'),
  NEXT_PUBLIC_KPI_AUTH_URL: getUrlEnv('NEXT_PUBLIC_KPI_AUTH_URL', 'https://auth.kpi.ua'),
  NEXT_PUBLIC_KPI_APP_ID: getEnv('NEXT_PUBLIC_KPI_APP_ID'),

  DATABASE_URL: getEnv('DATABASE_URL'),
  REDIS_URL: getEnv('REDIS_URL'),

  JWT_ACCESS_SECRET: getSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: getSecret('JWT_REFRESH_SECRET'),

  APP_URL: getUrlEnv('APP_URL', `http://localhost:${process.env.PORT ?? 3000}`),
  CAMPUS_API_URL: getEnv('CAMPUS_API_URL'),

  KPI_APP_SECRET: getEnv('KPI_APP_SECRET'),
  TRUSTED_PROXY_COUNT: getNumberEnv('TRUSTED_PROXY_COUNT', 1),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'production'),
};
