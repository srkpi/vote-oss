import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const adminInvitesRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/admins/invite',
    summary: 'List visible admin invite tokens',
    description:
      'Returns all non-expired, non-exhausted invite tokens that the caller created or that were created by an admin in their subordinate hierarchy. As a side-effect, stale tokens (expired or exhausted) are hard-deleted from the database. Requires `manage_admins`.\n',
    tags: ['Admin Invites'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Array of visible invite tokens', {
        type: 'array',
        items: schemaRef('InviteToken'),
      }),
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller does not have manage_admins' },
    },
  },
  {
    method: 'post',
    path: '/api/admins/invite',
    summary: 'Create an admin invite token',
    description:
      'Generates a new admin invite token with the specified permissions and validity. The raw plaintext token is returned exactly once and is never stored; only its SHA-256 hash is persisted. Requires `manage_admins`. A caller may hold at most `INVITE_TOKEN_MAX_COUNT` active tokens at a time.\nPermission constraints:\n  - A caller may only grant permission flags they themselves hold\n    (e.g. cannot grant `manageGroups` without having `manageGroups`).\n  - A faculty-restricted caller always creates faculty-restricted tokens\n    regardless of the `restrictedToFaculty` field in the request body.\n',
    tags: ['Admin Invites'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('InviteTokenCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Token created – raw token returned here only', {
        type: 'object',
        required: [
          'token',
          'maxUsage',
          'manageAdmins',
          'manageGroups',
          'managePetitions',
          'manageFaq',
          'restrictedToFaculty',
          'validDue',
        ],
        properties: {
          token: {
            type: 'string',
            description:
              'Raw (unhashed) invite token. Share this with the invitee; it is not stored on the server.',
          },
          maxUsage: { type: 'integer' },
          manageAdmins: { type: 'boolean' },
          manageGroups: { type: 'boolean' },
          managePetitions: { type: 'boolean' },
          manageFaq: { type: 'boolean' },
          restrictedToFaculty: { type: 'boolean' },
          validDue: { type: 'string', format: 'date-time' },
        },
      }),
      '400': {
        description: 'Validation error, missing validDue, invalid date, or token limit reached',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Caller lacks manage_admins, or is attempting to grant a permission they do not hold themselves.\n',
      },
    },
  },
  {
    method: 'delete',
    path: '/api/admins/invite/{tokenHash}',
    summary: 'Delete an invite token',
    description:
      "Permanently deletes a single admin invite token identified by its hash. The caller must have `manage_admins` and either own the token or be a transitive ancestor of the token's creator in the admin hierarchy.\n",
    tags: ['Admin Invites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        tokenHash: z
          .string()
          .openapi({ param: { description: 'SHA-256 hash of the raw invite token' } }),
      }),
    },
    responses: {
      '204': { description: 'Token deleted' },
      '400': { description: 'Missing tokenHash' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Forbidden – no manage_admins or token is outside caller's hierarchy" },
      '404': { description: 'Invite token not found' },
    },
  },
];
