import { z } from 'zod';

import { validationMessage } from '@/lib/schemas/common';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_KPI_AUTH_URL: z.url(),
  NEXT_PUBLIC_KPI_APP_ID: z.string().trim().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.url(),
  NEXT_PUBLIC_POSTHOG_ASSETS_HOST: z.url(),
  NEXT_PUBLIC_POSTHOG_TOKEN: z.string().optional(),
  NEXT_PUBLIC_GIT_SHA: z.string().optional(),
  NEXT_PUBLIC_GIT_REPO: z.string().optional(),
  NEXT_PUBLIC_GITHUB_RUN_ID: z.string().optional(),
  NEXT_PUBLIC_BUILD_TIME: z.string().optional(),
  NEXT_PUBLIC_DOCKER_IMAGE: z.string().optional(),
  NEXT_PUBLIC_DOCKER_TAG: z.string().optional(),
});

// Keep explicit property reads so Next.js can inline public values in the browser.
const result = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Vote OSS',
  NEXT_PUBLIC_KPI_AUTH_URL: process.env.NEXT_PUBLIC_KPI_AUTH_URL ?? 'https://auth.kpi.ua',
  NEXT_PUBLIC_KPI_APP_ID: process.env.NEXT_PUBLIC_KPI_APP_ID,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  NEXT_PUBLIC_POSTHOG_ASSETS_HOST:
    process.env.NEXT_PUBLIC_POSTHOG_ASSETS_HOST ?? 'https://eu-assets.i.posthog.com',
  NEXT_PUBLIC_POSTHOG_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_TOKEN,

  NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA,
  NEXT_PUBLIC_GIT_REPO: process.env.NEXT_PUBLIC_GIT_REPO,
  NEXT_PUBLIC_GITHUB_RUN_ID: process.env.NEXT_PUBLIC_GITHUB_RUN_ID,
  NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME,
  NEXT_PUBLIC_DOCKER_IMAGE: process.env.NEXT_PUBLIC_DOCKER_IMAGE,
  NEXT_PUBLIC_DOCKER_TAG: process.env.NEXT_PUBLIC_DOCKER_TAG,
});

if (!result.success) {
  throw new Error(`❌ Invalid public environment: ${validationMessage(result.error)}`);
}

export const clientEnv = result.data;
