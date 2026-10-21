import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const petitionCommentsRoutes: RouteConfig[] = [
  {
    method: 'put',
    path: '/api/elections/{id}/official-answer',
    summary: "Create or update the petition's official answer (admin, manage_petitions)",
    description:
      'Upsert — the first call creates the answer, later calls edit it. The original author stays recorded even when a different admin later edits it; the edit is tracked separately (editedBy/editedAt).\n',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ format: 'uuid' }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CommentCreateBody') } },
      },
    },
    responses: {
      '200': jsonResponse('The official answer', schemaRef('PetitionOfficialAnswer')),
      '400': { description: 'Empty answer, too long, or not a petition' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Admin lacks manage_petitions' },
      '404': { description: 'Petition not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/elections/{id}/official-answer',
    summary: "Remove the petition's official answer (admin, manage_petitions)",
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string().openapi({ format: 'uuid' }) }) },
    responses: {
      '204': { description: 'Removed' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Admin lacks manage_petitions' },
      '404': { description: 'Petition or answer not found' },
    },
  },
  {
    method: 'get',
    path: '/api/elections/{id}/comments',
    summary: 'List comments on a petition (cursor-paginated, sortable)',
    description:
      'Returns a page of top-level comments. Defaults to `sort=date`, `direction=asc` (oldest first), so reading top-to-bottom follows the natural flow of the discussion. Pass `cursor` (the `id` of the last comment already loaded) to fetch the next page, continuing in the same sort order. Defaults to 5 for the first page; pass a larger `limit` (capped at 20) for "load more" requests.\n`sort=rating` orders by net score (upvotes minus downvotes) instead of by date. `direction` reverses whichever sort is active; changing either one starts a new sequence, so the client should re-fetch with `cursor` omitted rather than reuse an old cursor from a different sort.\nEach comment reports whether the requester may edit/delete it, whether its author is the petition\'s creator or a current admin, and the requester\'s own vote on it, if any.\nThe petition detail endpoint (GET /elections/{id}) already embeds the default first page (oldest first) as `initialComments` — call this endpoint for "load more" and whenever the requested sort differs from that default.\n',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Petition UUID' } }),
      }),
      query: z.object({
        cursor: z
          .string()
          .openapi({
            format: 'uuid',
            param: { description: 'Id of the last comment already loaded' },
          })
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .openapi({ param: { description: 'Page size (default 5 for the first page)' } })
          .optional(),
        sort: z
          .enum(['date', 'rating'])
          .openapi({ param: { description: 'Sort field. Defaults to `date`.' } })
          .optional(),
        direction: z
          .enum(['asc', 'desc'])
          .openapi({
            param: {
              description: 'Sort direction. Defaults to `asc` (oldest/lowest-rated first).',
            },
          })
          .optional(),
      }),
    },
    responses: {
      '200': jsonResponse('A page of comments', schemaRef('CommentsListResponse')),
      '400': {
        description:
          'Invalid UUID, invalid cursor, not a petition, or an unrecognized `sort`/`direction` value\n',
      },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Petition not found (or not visible to the caller)' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/comments',
    summary: 'Post a new top-level comment on a petition',
    description:
      "Plain text only — the client applies the app's linkify helper for display, no HTML/markdown is interpreted server-side. Returns 403 when an admin has closed the petition's discussion.\n",
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().openapi({ format: 'uuid' }) }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CommentCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('The created comment', schemaRef('Comment')),
      '400': { description: 'Empty comment, comment too long, or invalid body' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Discussion is closed' },
      '404': { description: 'Petition not found' },
      '429': { description: 'Too many comments posted recently' },
    },
  },
  {
    method: 'patch',
    path: '/api/elections/{id}/comments/{commentId}',
    summary: 'Edit a comment (author only)',
    description:
      "Only the comment's own author may edit it — admins with manage_petitions can delete but not edit someone else's comment. Blocked with 403 while the discussion is closed.\n",
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid' }),
        commentId: z.string().openapi({ format: 'uuid' }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CommentCreateBody') } },
      },
    },
    responses: {
      '200': jsonResponse('The updated comment', schemaRef('Comment')),
      '400': { description: 'Empty body or too long' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Not the comment's author, or the discussion is closed" },
      '404': { description: 'Petition or comment not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/elections/{id}/comments/{commentId}',
    summary: 'Delete a comment (soft delete)',
    description:
      'The comment\'s own author may always delete it, even while the discussion is closed. Admins with manage_petitions may delete any comment at any time. The row is kept — with its text cleared from API responses — so the UI can show a "comment deleted" placeholder naming who deleted it and when.\n',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid' }),
        commentId: z.string().openapi({ format: 'uuid' }),
      }),
    },
    responses: {
      '200': jsonResponse('The comment, now shown as deleted', schemaRef('Comment')),
      '401': { description: 'Unauthorized' },
      '403': { description: "Not the comment's author and not a manage_petitions admin" },
      '404': { description: 'Petition or comment not found' },
    },
  },
  {
    method: 'get',
    path: '/api/elections/{id}/comments/{commentId}/votes',
    summary: 'List who voted on a comment',
    description:
      "Comment votes are not anonymous — returns each voter's name, direction, and timestamp, newest first. Avatars are resolved client-side via the app's avatar store, the same as everywhere else.\n",
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid' }),
        commentId: z.string().openapi({ format: 'uuid' }),
      }),
      query: z.object({
        cursor: z.string().openapi({ format: 'uuid' }).optional(),
        limit: z.number().int().min(1).optional(),
      }),
    },
    responses: {
      '200': jsonResponse('Voter list plus current totals', schemaRef('CommentVotersResponse')),
      '401': { description: 'Unauthorized' },
      '404': { description: 'Petition or comment not found' },
    },
  },
  {
    method: 'put',
    path: '/api/elections/{id}/comments/{commentId}/vote',
    summary: 'Cast or change your vote on a comment',
    description:
      'Idempotent set: call again with a different value to switch your vote. Comment votes are **not** anonymous — your name is visible to anyone who opens the "who voted" list on this comment. Voting stays open even while the petition\'s discussion is closed. You cannot vote on your own comment.\n',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid' }),
        commentId: z.string().openapi({ format: 'uuid' }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CommentVoteBody') } },
      },
    },
    responses: {
      '200': jsonResponse('Updated vote totals', schemaRef('CommentVoteSummary')),
      '400': { description: 'Invalid value, or voting on your own comment' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Petition or comment not found' },
      '429': { description: 'Too many vote changes recently' },
    },
  },
  {
    method: 'delete',
    path: '/api/elections/{id}/comments/{commentId}/vote',
    summary: 'Revoke your vote on a comment',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid' }),
        commentId: z.string().openapi({ format: 'uuid' }),
      }),
    },
    responses: {
      '200': jsonResponse('Updated vote totals', schemaRef('CommentVoteSummary')),
      '401': { description: 'Unauthorized' },
      '404': { description: 'Petition, comment, or existing vote not found' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/comments/open',
    summary: 'Open discussion on a petition (admin, manage_petitions)',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string().openapi({ format: 'uuid' }) }) },
    responses: {
      '200': jsonResponse('Discussion opened', schemaRef('DiscussionStatus')),
      '400': { description: 'Invalid UUID, not a petition, or already open' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Admin lacks manage_petitions' },
      '404': { description: 'Petition not found' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/comments/close',
    summary: 'Close discussion on a petition (admin, manage_petitions)',
    description:
      'Blocks new comments and edits to existing ones. Existing comments stay visible, can still be deleted (by their author or an admin), and votes on them can still be cast, changed, or revoked.\n',
    tags: ['Petition comments'],
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string().openapi({ format: 'uuid' }) }) },
    responses: {
      '200': jsonResponse('Discussion closed', schemaRef('DiscussionStatus')),
      '400': { description: 'Invalid UUID, not a petition, or already closed' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Admin lacks manage_petitions' },
      '404': { description: 'Petition not found' },
    },
  },
];
