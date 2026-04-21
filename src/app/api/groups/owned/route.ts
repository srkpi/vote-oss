import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { getUserOwnedGroups } from '@/lib/groups';

/**
 * @swagger
 * /api/groups/owned:
 *   get:
 *     summary: List groups owned by the caller (lightweight)
 *     description: >
 *       Returns a compact list of groups owned by the authenticated user.
 *       Used in the election creation form to offer GROUP_MEMBERSHIP restrictions.
 *       Results are cached per-user for 5 minutes.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of owned group summaries
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const groups = await getUserOwnedGroups(auth.user.sub);
  return NextResponse.json(groups);
}
