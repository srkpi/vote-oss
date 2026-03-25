function requirePublicEnv(key: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`❌ Missing environment variable: ${key}`);
  return value.trim();
}

export const clientEnv = {
  NEXT_PUBLIC_APP_URL: requirePublicEnv('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Vote OSS',
  NEXT_PUBLIC_KPI_AUTH_URL: process.env.NEXT_PUBLIC_KPI_AUTH_URL ?? 'https://auth.kpi.ua',
  NEXT_PUBLIC_KPI_APP_ID: requirePublicEnv(
    'NEXT_PUBLIC_KPI_APP_ID',
    process.env.NEXT_PUBLIC_KPI_APP_ID,
  ),
};
