import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { z } from '../zod';

export const usersRoutes: RouteConfig[] = [
  {
    method: 'put',
    path: '/api/users/{id}/avatar',
    summary: "Upload or replace the caller's own avatar",
    description:
      'Self-serve only — the path id must match the authenticated user. Accepts `multipart/form-data` with a single `file` field (PNG, JPEG, or WebP, max 256 KiB). The image is decoded and re-encoded from scratch to a 512×512 WebP; EXIF/ICC metadata is always stripped. Rate-limited per user.\n',
    tags: ['Users'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Avatar uploaded' },
      '400': { description: 'Missing/empty file field' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller may only upload their own avatar' },
      '413': { description: 'File too large, or too large even after compression' },
      '415': { description: 'Unsupported or invalid image' },
      '429': { description: 'Too many uploads — try again later' },
      '502': { description: 'Object storage upload failed' },
    },
  },
  {
    method: 'delete',
    path: '/api/users/{id}/avatar',
    summary: "Remove a user's avatar",
    description:
      'Removable by the user themselves, or by any admin. A no-op (204) if no avatar is currently set.\n',
    tags: ['Users'],
    security: [{ cookieAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      '204': { description: 'Avatar removed (or none was set)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is neither the user nor an admin' },
    },
  },
  {
    method: 'get',
    path: '/api/users/avatars',
    summary: 'Batch-resolve avatar URLs for a set of user ids',
    description:
      'Given `?ids=a,b,c`, returns only the ids that currently have an avatar. Absence of an id from the response means that user has no avatar. Intended for client-side cases where the relevant user ids are only known after some other client-side step (e.g. decrypting ballots) — call this once with the whole batch, never once per row.\n',
    tags: ['Users'],
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        ids: z.string().openapi({ param: { description: 'Comma-separated user ids' } }),
      }),
    },
    responses: {
      '200': { description: 'Map of userId -> avatar URL' },
      '400': { description: 'Missing or too many ids' },
      '401': { description: 'Unauthorized' },
    },
  },
];
