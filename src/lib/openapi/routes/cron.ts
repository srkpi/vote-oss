import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse } from '../helpers';

export const cronRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: '/api/cron/cleanup-tokens',
    summary: 'Purge expired JWT token records',
    description:
      'Cron job endpoint that deletes JWT token rows older than the refresh token TTL. Must be called with a `Bearer <CRON_SECRET>` Authorization header. Intended for scheduled invocation only (e.g. Vercel Cron).\n',
    tags: ['Cron'],
    security: [{ cronSecret: [] }],
    responses: {
      '200': jsonResponse('Cleanup completed', {
        type: 'object',
        properties: {
          deleted: { type: 'integer', description: 'Number of expired token rows removed' },
        },
      }),
      '401': { description: 'Missing or invalid cron secret' },
      '500': { description: 'Database error during cleanup' },
    },
  },
  {
    method: 'post',
    path: '/api/cron/cleanup-bypass',
    summary: 'Purge expired bypass token records',
    description:
      'Purges expired global bypass tokens. Must be called with a `Bearer <CRON_SECRET>` Authorization header. Intended for scheduled invocation only (e.g. Vercel Cron).\n',
    tags: ['Cron'],
    security: [{ cronSecret: [] }],
    responses: {
      '200': jsonResponse('Cleanup completed', {
        type: 'object',
        properties: {
          deleted: {
            type: 'integer',
            description: 'Number of expired global bypass tokens deleted',
          },
        },
      }),
      '401': { description: 'Missing or invalid cron secret' },
      '500': { description: 'Database error during cleanup' },
    },
  },
  {
    method: 'post',
    path: '/api/cron/campaign-tick',
    summary: 'Advance election campaigns through their state machine',
    description:
      "Walks every active (non-cancelled, non-completed) campaign and transitions its `state` field to whatever the current clock implies based on the campaign's configured phase timestamps. Child entity creation (registration forms, signature elections, final election) happens in subsequent stages. Must be called with a `Bearer <CRON_SECRET>` Authorization header. Intended for scheduled invocation only (e.g. Vercel Cron).\n",
    tags: ['Cron'],
    security: [{ cronSecret: [] }],
    responses: {
      '200': jsonResponse('Tick completed', {
        type: 'object',
        required: ['updated'],
        properties: {
          updated: {
            type: 'integer',
            description: 'Number of campaigns whose state was updated in this tick',
          },
        },
      }),
      '401': { description: 'Missing or invalid cron secret' },
      '500': { description: 'Unexpected error during state machine processing' },
    },
  },
];
