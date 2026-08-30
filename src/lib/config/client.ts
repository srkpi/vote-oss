import { clientEnv } from '@/lib/config/env-client';

export const APP_NAME = clientEnv.NEXT_PUBLIC_APP_NAME;
export const APP_URL = clientEnv.NEXT_PUBLIC_APP_URL;
export const KPI_AUTH_URL = clientEnv.NEXT_PUBLIC_KPI_AUTH_URL;
export const KPI_APP_ID = clientEnv.NEXT_PUBLIC_KPI_APP_ID;

export const POSTHOG_HOST = clientEnv.NEXT_PUBLIC_POSTHOG_HOST;
export const POSTHOG_ASSETS_HOST = clientEnv.NEXT_PUBLIC_POSTHOG_ASSETS_HOST;
export const POSTHOG_TOKEN = clientEnv.NEXT_PUBLIC_POSTHOG_TOKEN;

export const GIT_SHA = clientEnv.NEXT_PUBLIC_GIT_SHA;
export const GIT_REPO = clientEnv.NEXT_PUBLIC_GIT_REPO;
export const GITHUB_RUN_ID = clientEnv.NEXT_PUBLIC_GITHUB_RUN_ID;
export const BUILD_TIME = clientEnv.NEXT_PUBLIC_BUILD_TIME;
export const DOCKER_IMAGE = clientEnv.NEXT_PUBLIC_DOCKER_IMAGE;
export const DOCKER_TAG = clientEnv.NEXT_PUBLIC_DOCKER_TAG;
