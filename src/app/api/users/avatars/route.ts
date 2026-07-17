import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { MAX_RESOLVE_AVATAR_URLS_PER_REQUEST } from '@/lib/constants';
import { Errors } from '@/lib/errors';

/**
 * @swagger
 * /api/users/avatars:
 *   get:
 *     summary: Batch-resolve avatar URLs for a set of user ids
 *     description: >
 *       Given `?ids=a,b,c`, returns only the ids that currently have an
 *       avatar. Absence of an id from the response means that user has no
 *       avatar. Intended for client-side cases where the relevant user ids
 *       are only known after some other client-side step (e.g. decrypting
 *       ballots) — call this once with the whole batch, never once per row.
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: ids
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated user ids
 *     responses:
 *       200:
 *         description: Map of userId -> avatar URL
 *       400:
 *         description: Missing or too many ids
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const raw = req.nextUrl.searchParams.get('ids');
  if (!raw) return Errors.badRequest('Query param "ids" is required');

  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return Errors.badRequest('Query param "ids" is required');
  if (ids.length > MAX_RESOLVE_AVATAR_URLS_PER_REQUEST) {
    return Errors.badRequest(
      `Too many ids — max ${MAX_RESOLVE_AVATAR_URLS_PER_REQUEST} per request`,
    );
  }

  const avatarMap = await getAvatarUrlMap(ids);
  return NextResponse.json({ avatars: Object.fromEntries(avatarMap) });
}
