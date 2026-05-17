import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { getUserOwnedGroups } from '@/lib/groups';

/**
 * @swagger
 * /api/groups/owned:
 *   get:
 *     summary: List groups owned by the authenticated user
 *     description: >
 *       Returns a compact list of non-deleted groups for which the caller is
 *       the owner. Primarily used in the election creation form to populate
 *       GROUP_MEMBERSHIP restriction options. Results are cached per-user.
 *     tags:
 *       - Groups
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of owned group summaries (may be empty)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 required:
 *                   - id
 *                   - name
 *                   - memberCount
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   memberCount:
 *                     type: integer
 *                     minimum: 0
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const groups = await getUserOwnedGroups(auth.user.sub);
  return NextResponse.json(groups);
}
