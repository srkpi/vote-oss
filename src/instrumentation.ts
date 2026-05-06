import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';

import { POSTHOG_HOST, POSTHOG_TOKEN } from '@/lib/config/client';
import { getPostHogServer } from '@/lib/posthog-server';

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ 'service.name': 'vote-oss' }),
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${POSTHOG_HOST}/i/v1/logs`,
        headers: {
          Authorization: `Bearer ${POSTHOG_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }),
    ),
  ],
});

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    logs.setGlobalLoggerProvider(loggerProvider);
    // Node-only side-effects (Prisma, node:crypto) live in a separate module
    // so Next.js's edge-runtime bundler doesn't try to traverse them.
    await import('@/lib/dev-cron');
  }
}

type NodeHeaders = {
  cookie?: string | string[];
  [key: string]: unknown;
};

export const onRequestError = async (
  err: Error,
  request: { headers?: NodeHeaders } | undefined,
) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const posthog = getPostHogServer();
    let distinctId = null;

    if (request?.headers?.cookie) {
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join('; ')
        : request.headers.cookie;

      const postHogCookieMatch = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/);

      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
          const postHogData = JSON.parse(decodedCookie);
          distinctId = postHogData.distinct_id;
        } catch (e) {
          console.error('Error parsing PostHog cookie:', e);
        }
      }
    }

    await posthog.captureException(err, distinctId || undefined);
  }
};
