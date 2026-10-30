import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const bypassRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/elections/{id}/bypass',
    summary: 'List bypass tokens for an election',
    description:
      'Returns ALL bypass tokens for the election — including soft-deleted ones — so admins can review the full access history. Soft-deleted tokens have a non-null `deletedAt` field and are shown with their complete usage records for audit purposes. The caller must be the election creator or a transitive ancestor in the admin hierarchy.\n',
    tags: ['Bypass', 'Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of election bypass tokens (active and deleted)', {
        type: 'array',
        items: schemaRef('ElectionBypassToken'),
      }),
      '400': { description: 'Invalid election UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Election not found' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/bypass',
    summary: 'Create an election bypass token',
    description:
      "Creates a new election-scoped bypass token that grants the holder access to vote despite not meeting some of the election's restrictions. The token's validity is implicitly tied to the election's closes_at — no explicit validUntil is accepted. The caller must be the election creator or a transitive ancestor in the admin hierarchy.\n",
    tags: ['Bypass', 'Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('ElectionBypassTokenCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Bypass token created – raw token returned here only', {
        type: 'object',
        required: ['token', 'tokenHash', 'electionId', 'bypassRestrictions', 'maxUsage'],
        properties: {
          token: { type: 'string', description: 'Raw token to share with the student' },
          tokenHash: { type: 'string', description: 'SHA-256 hash of the token' },
          electionId: { type: 'string', format: 'uuid' },
          bypassRestrictions: { type: 'array', items: schemaRef('ElectionRestrictionType') },
          maxUsage: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum number of times this token can be used',
          },
        },
      }),
      '400': { description: 'Validation error' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '404': { description: 'Election not found' },
    },
  },
  {
    method: 'get',
    path: '/api/bypass',
    summary: 'List global bypass tokens',
    description:
      'Returns all global bypass tokens whose `valid_until` is in the future, regardless of whether they have been soft-deleted. This means tokens that have been deleted but have not yet expired are still returned (with a non-null `deletedAt`) so that their full usage history remains accessible for audit purposes. Fully expired tokens are excluded.\nOnly non-restricted admins may access this endpoint. The `canDelete` and `canRevokeUsages` flags on each token indicate what actions the calling admin may perform.\n',
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse(
        'Array of global bypass tokens (including soft-deleted, excluding expired)',
        { type: 'array', items: schemaRef('GlobalBypassToken') },
      ),
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is a faculty-restricted admin' },
    },
  },
  {
    method: 'post',
    path: '/api/bypass',
    summary: 'Create a global bypass token',
    description:
      'Creates a new global bypass token that allows a student to bypass platform-level access checks (not-studying status or graduate level). Only non-restricted admins can create global bypass tokens.\n',
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('GlobalBypassTokenCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Token created — raw token returned once', {
        type: 'object',
        required: [
          'token',
          'tokenHash',
          'bypassNotStudying',
          'bypassGraduate',
          'maxUsage',
          'validUntil',
        ],
        properties: {
          token: { type: 'string', description: 'Raw token to share with the student' },
          tokenHash: { type: 'string', description: 'SHA-256 hash of the token' },
          bypassNotStudying: {
            type: 'boolean',
            description: 'Whether this token allows bypassing "not studying" status',
          },
          bypassGraduate: {
            type: 'boolean',
            description: 'Whether this token allows bypassing "graduate" status',
          },
          maxUsage: {
            type: 'integer',
            minimum: 1,
            description: 'Maximum number of times this token can be used',
          },
          validUntil: { type: 'string', format: 'date-time', description: 'Expiration timestamp' },
        },
      }),
      '400': { description: 'Validation error' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – restricted admin' },
    },
  },
  {
    method: 'delete',
    path: '/api/bypass/global/{tokenHash}',
    summary: 'Soft-delete a global bypass token',
    description:
      'Marks the specified global bypass token as deleted (sets `deleted_at` and `deleted_by`). As part of the same operation, all existing active usages of the token are revoked (their `revoked_at` and `revoked_by` are set), immediately removing platform access granted through this token. Because global bypass tokens gate platform-level access, users whose bypass was revoked will be denied on their next token refresh.\nThe token and its usage history remain visible for audit purposes. Only non-restricted admins may manage global bypass tokens. The caller must be the creator or a transitive ancestor in the admin hierarchy.\n',
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        tokenHash: z
          .string()
          .openapi({ param: { description: 'SHA-256 hex hash of the raw bypass token' } }),
      }),
    },
    responses: {
      '204': { description: 'Token soft-deleted and all usages revoked' },
      '400': { description: 'Missing tokenHash or token is already deleted' },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          "Forbidden – caller is faculty-restricted, or is outside the creator's hierarchy branch",
      },
      '404': { description: 'Token not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/bypass/global/{tokenHash}/usages/{userId}',
    summary: "Revoke a user's global bypass access",
    description:
      "Sets `revoked_at` and `revoked_by` on the specified usage record, preventing the user from benefiting from this bypass token in future requests. Because global bypass tokens gate platform access (not just a single election), revoking a usage will cause the user's next token refresh to fail, effectively forcing re-authentication.\nPermission model:\n  - Non-restricted admins may revoke any usage.\n  - Faculty-restricted admins may only revoke usages on tokens they\n    themselves created.\n",
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        tokenHash: z
          .string()
          .openapi({ param: { description: 'SHA-256 hex hash of the raw bypass token' } }),
        userId: z
          .string()
          .openapi({ param: { description: 'User ID whose bypass usage should be revoked' } }),
      }),
    },
    responses: {
      '204': { description: 'Usage revoked' },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Forbidden – faculty-restricted admin trying to revoke a usage on a token they did not create',
      },
      '404': { description: 'Token or usage not found' },
      '409': { description: 'Bypass usage is already revoked' },
    },
  },
  {
    method: 'delete',
    path: '/api/bypass/election/{tokenHash}',
    summary: 'Soft-delete an election bypass token',
    description:
      "Marks the specified election bypass token as deleted (sets `deleted_at` and `deleted_by`). As part of the same operation, all existing active usages of the token are revoked (their `revoked_at` and `revoked_by` are set), immediately removing the bypass eligibility for every user who had activated this token for this election.\nThe token and its full usage history remain visible in the election bypass panel for audit purposes. The caller must be the token's creator or a transitive ancestor of the creator in the admin hierarchy.\n",
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        tokenHash: z
          .string()
          .openapi({ param: { description: 'SHA-256 hex hash of the raw bypass token' } }),
      }),
    },
    responses: {
      '204': { description: 'Token soft-deleted and all usages revoked' },
      '400': { description: 'Missing tokenHash or token is already deleted' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Forbidden – caller is outside the creator's hierarchy branch" },
      '404': { description: 'Token not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/bypass/election/{tokenHash}/usages/{userId}',
    summary: "Revoke a user's election bypass access",
    description:
      "Sets `revoked_at` and `revoked_by` on the specified election bypass usage record, immediately removing that user's bypass eligibility for the associated election. The user's bypass cache is also invalidated.\nPermission model:\n  - Non-restricted admins may revoke any usage.\n  - Faculty-restricted admins may only revoke usages on tokens they\n    themselves created.\n",
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        tokenHash: z
          .string()
          .openapi({ param: { description: 'SHA-256 hex hash of the raw bypass token' } }),
        userId: z
          .string()
          .openapi({ param: { description: 'User ID whose bypass usage should be revoked' } }),
      }),
    },
    responses: {
      '204': { description: 'Usage revoked' },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Forbidden – faculty-restricted admin trying to revoke a usage on a token they did not create',
      },
      '404': { description: 'Token or usage not found' },
      '409': { description: 'Bypass usage is already revoked' },
    },
  },
  {
    method: 'post',
    path: '/api/bypass/apply',
    summary: 'Apply a bypass token',
    description:
      'Validates and activates a raw bypass token for the authenticated user. The system checks for a Global token first, then an Election-specific token. This operation is idempotent; applying the same token twice will not increment usage counts further.\n',
    tags: ['Bypass'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: {
                token: {
                  type: 'string',
                  description: 'The raw base64 bypass token provided to the user.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse('Token successfully applied or already active.', {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['GLOBAL', 'ELECTION'],
            description: 'The scope of the bypass granted.',
          },
          electionId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'The ID of the election if the type is `ELECTION`; otherwise null.',
          },
        },
      }),
      '400': {
        description:
          'Bad Request. Possible reasons: - Token has expired. - Usage limit reached. - Access has been revoked. - Election deleted or closed.\n',
      },
      '401': { description: 'Unauthorized - User session is invalid or missing.' },
      '404': { description: 'Not Found - The provided token does not exist.' },
      '409': { description: 'Conflict - State conflict preventing token application.' },
      '500': { description: 'Internal server error.' },
    },
  },
];
