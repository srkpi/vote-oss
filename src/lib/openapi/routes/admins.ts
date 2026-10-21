import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const adminsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/admins',
    summary: 'List all active admins',
    description:
      'Returns every non-deleted admin record, augmented with a `deletable` flag indicating whether the caller may remove that admin. Results are served from cache when available. Requires admin authentication.\n',
    tags: ['Admins'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Array of admin records', {
        type: 'array',
        items: {
          allOf: [
            schemaRef('Admin'),
            {
              type: 'object',
              properties: {
                deletable: {
                  type: 'boolean',
                  description: 'Whether the calling admin may delete this record',
                },
              },
            },
          ],
        },
      }),
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is not an admin' },
    },
  },
  {
    method: 'get',
    path: '/api/admins/{userId}',
    summary: 'Get a single admin by user ID',
    description:
      'Returns full admin details for the given user ID. Served from cache when available. Requires admin authentication.',
    tags: ['Admins'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        userId: z
          .string()
          .openapi({ param: { description: 'The user ID of the admin to retrieve' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Admin record', schemaRef('Admin')),
      '400': { description: 'Missing userId' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is not an admin' },
      '404': { description: 'Admin not found' },
    },
  },
  {
    method: 'patch',
    path: '/api/admins/{userId}',
    summary: "Update an admin's permissions",
    description:
      'Updates one or more permission flags for the target admin. Settable flags are `manageAdmins`, `manageGroups`, `managePetitions`, `manageFaq`, and `restrictedToFaculty`. At least one must be provided.\nAuthorization rules:\n  - Caller must have `manage_admins`.\n  - Caller must be a transitive ancestor of the target in the admin\n    hierarchy.\n  - A faculty-restricted caller cannot set `restrictedToFaculty: false`\n    (cannot grant broader access than their own).\n\nSide-effects on permission change:\n  - If `manageAdmins` changes, all invite tokens created by the target\n    are hard-deleted (they may have granted incorrect permissions).\n  - If `restrictedToFaculty` changes from false → true, invite tokens\n    created by the target with `restrictedToFaculty: false` are\n    hard-deleted.\n',
    tags: ['Admins'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        userId: z
          .string()
          .openapi({ param: { description: 'The user ID of the admin to update' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                manageAdmins: {
                  type: 'boolean',
                  description: 'Grant or revoke the ability to invite/remove other admins.',
                },
                manageGroups: {
                  type: 'boolean',
                  description: 'Grant or revoke the ability to manage groups.',
                },
                managePetitions: {
                  type: 'boolean',
                  description: 'Grant or revoke the ability to approve/delete petitions.',
                },
                manageFaq: {
                  type: 'boolean',
                  description: 'Grant or revoke the ability to manage FAQ content.',
                },
                restrictedToFaculty: {
                  type: 'boolean',
                  description:
                    'When true, the admin can only see and manage resources scoped to their own faculty. A faculty-restricted caller cannot set this to false.\n',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Permissions updated successfully' },
      '400': {
        description:
          'Missing userId, attempting to update self, no fields provided, or faculty-restricted caller trying to grant unrestricted access.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          "Caller lacks manage_admins, or the target is outside the caller's hierarchy branch.\n",
      },
      '404': { description: 'Target admin not found or already deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/admins/{userId}',
    summary: 'Remove an admin',
    description:
      "Soft-deletes the target admin and hard-deletes all invite tokens they created. Direct children of the removed admin are re-parented to the removed admin's own parent, keeping the hierarchy intact without gaps. The caller must have `manage_admins` and be a transitive ancestor of the target in the admin hierarchy. A caller cannot remove themselves.\n",
    tags: ['Admins'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        userId: z
          .string()
          .openapi({ param: { description: 'The user ID of the admin to remove' } }),
      }),
    },
    responses: {
      '204': { description: 'Admin successfully removed' },
      '400': { description: 'Missing userId or attempting to remove self' },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          "Forbidden – no manage_admins permission or target is outside caller's hierarchy branch",
      },
      '404': { description: 'Target admin not found' },
    },
  },
  {
    method: 'post',
    path: '/api/admins/leave',
    summary: 'Leave the admin platform',
    description:
      "Allows an admin to voluntarily soft-delete their own record. If the caller has subordinates they must supply a `replacementId` — an admin in their hierarchy branch who will take their place. The replacement is promoted to the caller's position in the hierarchy tree. Admins with no subordinates may leave without specifying a replacement. The last admin on the platform cannot leave.\n",
    tags: ['Admins'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                replacementId: {
                  type: 'string',
                  nullable: true,
                  description:
                    "User ID of the admin (from caller's subtree) who should take the caller's place. Required when the caller has subordinates; omit or set to null otherwise.\n",
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Successfully left the platform' },
      '400': {
        description:
          "Only admin on platform, or has subordinates but no replacementId provided, or replacement is not in caller's hierarchy branch.\n",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is not an admin' },
      '404': { description: 'Replacement admin not found or is inactive' },
    },
  },
  {
    method: 'post',
    path: '/api/admins/join',
    summary: 'Become an admin via invite token',
    description:
      'Redeems a valid invite token for the currently authenticated user, creating or reactivating their admin record. If the token reaches its maximum usage after this redemption it is automatically deleted. Any logged-in user (non-admin included) may call this endpoint.\n',
    tags: ['Admins'],
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
                  description: 'Raw (unhashed) invite token received from an existing admin',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': { description: 'Admin record created or reactivated' },
      '400': { description: 'Missing token, expired token, or token usage limit reached' },
      '401': { description: 'Unauthorized – user is not logged in' },
      '404': { description: 'Invalid invite token' },
      '409': { description: 'User is already an active admin' },
    },
  },
];
