import posthog from 'posthog-js';

import { POSTHOG_TOKEN } from '@/lib/config/client';

posthog.init(POSTHOG_TOKEN, {
  api_host: '/ph',
  ui_host: 'https://eu.posthog.com',
  defaults: '2026-01-30',
  capture_pageview: false,
  capture_pageleave: true,
});
