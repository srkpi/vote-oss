import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const groupsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/groups',
    summary: 'List groups the caller belongs to or can discover',
    description:
      'Returns two categories of groups combined into a single array:\n1. All non-deleted groups the caller is an active member of (ordered\n   by join date ascending).\n2. Groups the caller is NOT a member of but which have at least one\n   non-deleted, publicly-viewable election restricted to their\n   membership (so non-members can discover the group via its public\n   poll).\n\nEach entry includes computed `isOwner` and `isMember` flags. Admins with `manage_groups` who need the full system-wide group list should use GET /api/groups/all.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Array of group summaries', {
        type: 'array',
        items: schemaRef('GroupSummary'),
      }),
      '401': { description: 'Unauthorized' },
    },
  },
  {
    method: 'post',
    path: '/api/groups',
    summary: 'Create a new group',
    description:
      'Creates a group and automatically adds the creator as its owner and first member. Requires admin authentication with `manage_groups` permission. A user may own at most `GROUP_MAX_OWNED` groups simultaneously.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 100,
                  description: 'Display name for the new group.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': jsonResponse('Group created', schemaRef('GroupSummary')),
      '400': { description: 'Missing or invalid name, or ownership limit reached' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is not an admin with manage_groups' },
    },
  },
  {
    method: 'get',
    path: '/api/groups/{id}',
    summary: 'Get group details including members, invite links, and elections',
    description:
      "Returns full group details. Access rules:\n  - Active members always have full access.\n  - Non-members may access the group if at least one publicly-viewable\n    election targets this group's membership, or if the group has at\n    least one protocol. Non-members only see publicly-viewable elections.\n  - Non-members who do not satisfy any of the above conditions receive 403.\n  - Admins with `manage_groups` always have full access.\n\nInvite links are only included in the response for the group owner and admins with `manage_groups`; all other callers receive an empty array.\n",
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Group details', schemaRef('GroupDetail')),
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Caller is not a member and no publicly-viewable election or protocol exists for the group',
      },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'patch',
    path: '/api/groups/{id}',
    summary: 'Update group properties (name, type, or requisites)',
    description:
      'Three independent sub-operations, each gated by its own permission:\n- `name` — only the group owner may rename the group. - `type` — only admins with `manage_groups` may change the group type\n  (VKSU ↔ OTHER). Changing type invalidates the VKSU group cache.\n- `requisites` — only the group owner may update the official contact\n  details used for protocol document generation. Accepts a partial\n  object; only provided fields are updated. Setting a field to null\n  clears it.\n\nAt least one of `name`, `type`, or `requisites` must be present. When `requisites` is present it must contain at least one sub-field.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  maxLength: 100,
                  description: 'New display name. Owner-only.',
                },
                type: {
                  type: 'string',
                  enum: ['VKSU', 'OTHER'],
                  description: 'New group type. Requires manage_groups.',
                },
                requisites: {
                  type: 'object',
                  description:
                    "Partial update to the group's official contact details. Owner-only.",
                  properties: {
                    fullName: { type: 'string', nullable: true },
                    address: { type: 'string', nullable: true },
                    email: {
                      type: 'string',
                      nullable: true,
                      description: 'Must be a valid email address when non-null.',
                    },
                    contact: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Group updated' },
      '400': {
        description:
          'No fields provided, invalid type value, requisites object has no sub-fields, requisites field exceeds maximum length, or email is not a valid address.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Caller is not the owner when renaming or editing requisites, or caller does not have manage_groups when changing type.\n',
      },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/groups/{id}',
    summary: 'Soft-delete a group',
    description:
      'Marks the group as deleted. Only the group owner or an admin with `manage_groups` may delete a group. After deletion, the group-membership caches of all active members are invalidated so election eligibility is immediately re-evaluated. The VKSU group ID cache is also invalidated when the deleted group was of type VKSU.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Group soft-deleted' },
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is neither the group owner nor an admin with manage_groups' },
      '404': { description: 'Group not found or already soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/{id}/transfer',
    summary: 'Transfer group ownership to another member',
    description:
      'Transfers ownership of the group to another user. After transfer, the previous owner becomes a plain member.\nAuthorization:\n  - The current group owner can transfer to any active member.\n  - An admin with `manage_groups` can only transfer ownership to\n    **themselves** (admin takeover for moderation purposes). If the\n    admin is not already a member, they are automatically added.\n\nThe owned-groups caches of both the previous and new owner are invalidated.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['newOwnerId'],
              properties: {
                newOwnerId: {
                  type: 'string',
                  description: 'User ID of the user who will become the new owner.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Ownership transferred' },
      '400': {
        description: 'Invalid UUID, missing newOwnerId, or the specified user is already the owner',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          'Caller is not the current owner and is not an admin with manage_groups, or an admin is trying to transfer to someone other than themselves',
      },
      '404': {
        description:
          'Group not found, soft-deleted, or the target user is not an active member (and the caller is not an admin taking over)',
      },
    },
  },

  {
    method: 'get',
    path: '/api/groups/{id}/members',
    summary: 'List active members of a group',
    description:
      'Returns all non-deleted members ordered by join date ascending. Only accessible to current active members of the group or admins with `manage_groups`.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of active group members', {
        type: 'array',
        items: schemaRef('GroupMember'),
      }),
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '403': {
        description: 'Caller is not a member of this group and does not have manage_groups',
      },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/groups/{id}/members/{userId}',
    summary: 'Remove a member from a group (kick or self-leave)',
    description:
      "- Any active member may call this endpoint with their own userId to\n  **leave** the group.\n- The group owner may call this to **kick** any member except\n  themselves. The owner must transfer ownership before leaving.\n- An admin with `manage_groups` may kick any member from any group.\nThe removed member's group-membership cache is invalidated.\n",
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
        userId: z.string().openapi({ param: { description: 'User ID of the member to remove' } }),
      }),
    },
    responses: {
      '204': { description: 'Member removed' },
      '400': {
        description:
          'Invalid group UUID, missing userId, or the target is the group owner (must transfer ownership first)',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description: 'Caller is not the target, not the owner, and does not have manage_groups',
      },
      '404': { description: 'Group not found or the specified user is not an active member' },
    },
  },
  {
    method: 'patch',
    path: '/api/groups/{id}/members/{userId}',
    summary: "Update a member's role label",
    description:
      'Sets or clears the free-form `role` field on a group member record. The role is used in protocol document generation (e.g. "Голова", "Секретар"). An empty string or null clears the role. Only the group owner may call this endpoint.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
        userId: z.string().openapi({
          param: { description: 'User ID of the member whose role should be updated' },
        }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['role'],
              properties: {
                role: {
                  type: 'string',
                  nullable: true,
                  description: 'New role label. Null or empty string clears the role.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '204': { description: 'Role updated' },
      '400': {
        description:
          'Invalid UUID, missing role field, role value not a string or null, or role exceeds maximum length',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Group not found or the specified user is not an active member' },
    },
  },
  {
    method: 'get',
    path: '/api/groups/{id}/invite-links',
    summary: 'List invite links for a group',
    description:
      'Returns all invite links for the group — both active and revoked — so the owner can review the full history. Only the group owner or an admin with `manage_groups` may access this endpoint.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of invite links ordered by creation date descending', {
        type: 'array',
        items: schemaRef('GroupInviteLink'),
      }),
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is neither the group owner nor an admin with manage_groups' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/{id}/invite-links',
    summary: 'Create a new invite link for the group',
    description:
      'Generates a new invite link with the specified usage cap and expiry. The raw token is returned exactly once (in the `token` field) and is not stored; only its hash is persisted. Only the group owner or an admin with `manage_groups` may create links. A group may have at most `GROUP_INVITE_LINK_MAX_ACTIVE` active links simultaneously.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['maxUsage', 'expiresAt'],
              properties: {
                label: {
                  type: 'string',
                  description: 'Optional human-readable label for the link (e.g. "Freshers 2024").',
                },
                maxUsage: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Maximum number of times this link may be used to join the group.',
                },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  description:
                    'Expiry timestamp. Must be at least 1 hour and at most the configured maximum days in the future.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': jsonResponse('Invite link created – raw token returned here only', {
        allOf: [
          schemaRef('GroupInviteLink'),
          {
            type: 'object',
            required: ['token'],
            properties: {
              token: {
                type: 'string',
                description:
                  'Raw (unhashed) invite token. Share this with prospective members; it is not stored on the server.',
              },
            },
          },
        ],
      }),
      '400': {
        description:
          'Validation error or the group already has the maximum number of active invite links',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is neither the group owner nor an admin with manage_groups' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/groups/{id}/invite-links/{linkId}',
    summary: 'Revoke (soft-delete) an invite link',
    description:
      'Marks the invite link as revoked so it can no longer be used to join the group. Existing memberships obtained through the link are unaffected. The group owner or an admin with `manage_groups` may revoke links.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
        linkId: z.string().openapi({ format: 'uuid', param: { description: 'Invite link UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Link revoked' },
      '400': { description: 'Invalid UUID or link is already revoked' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is neither the group owner nor an admin with manage_groups' },
      '404': {
        description: 'Group not found, link not found, or link does not belong to this group',
      },
    },
  },
  {
    method: 'put',
    path: '/api/groups/{id}/avatar',
    summary: 'Upload or replace the group logo',
    description:
      'Accepts a `multipart/form-data` request with a single `file` field. Atomically uploads the new logo to the object storage bucket, links it to the group in the database, and soft-deletes the previous logo file row (if any) followed by best-effort removal of the old object from storage. Only the group owner may call this endpoint.\nAllowed MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. SVG is intentionally rejected. The MIME type is detected from the file magic bytes regardless of the declared content-type.\nMaximum file size is enforced by the server; the exact limit is configured via `AVATAR_MAX_SIZE_BYTES`.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'Image file (PNG, JPEG, WebP, or GIF). Maximum size enforced server-side.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse('Logo uploaded and linked', schemaRef('FileSummary')),
      '400': { description: 'Missing or empty file field, or non-multipart request body' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Group not found or soft-deleted' },
      '413': { description: 'File exceeds the maximum allowed size' },
      '415': {
        description:
          'Unsupported file type or declared content-type does not match detected MIME type',
      },
      '502': { description: 'Object storage upload failed' },
    },
  },
  {
    method: 'delete',
    path: '/api/groups/{id}/avatar',
    summary: 'Remove the group logo',
    description:
      'Unlinks the group logo by setting `logo_file_id` to null and soft-deletes the associated File row, followed by best-effort removal of the object from storage. A no-op (204) is returned if no logo is currently set. Only the group owner may call this endpoint.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Logo removed (or no logo was set)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'get',
    path: '/api/groups/owned',
    summary: 'List groups owned by the authenticated user',
    description:
      'Returns a compact list of non-deleted groups for which the caller is the owner. Primarily used in the election creation form to populate GROUP_MEMBERSHIP restriction options. Results are cached per-user.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Array of owned group summaries (may be empty)', {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'memberCount'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            memberCount: { type: 'integer', minimum: 0 },
          },
        },
      }),
      '401': { description: 'Unauthorized' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/join',
    summary: 'Join a group via invite token',
    description:
      'Validates and applies a raw group invite token.  Idempotent — joining a group you are already a member of returns success without incrementing the usage counter.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token'],
              properties: { token: { type: 'string' } },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse('Joined (or already a member)', {
        type: 'object',
        properties: { groupId: { type: 'string', format: 'uuid' }, groupName: { type: 'string' } },
      }),
      '400': { description: 'Token expired or usage limit reached' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Invalid token' },
    },
  },
  {
    method: 'get',
    path: '/api/groups/all',
    summary: 'List all groups (admin only)',
    description:
      'Returns every non-deleted group in the system with member counts and owner information.  Requires admin authentication with manage_groups permission.\n',
    tags: ['Groups'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': { description: 'Array of all groups' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – not an admin or missing manage_groups permission' },
    },
  },
];
