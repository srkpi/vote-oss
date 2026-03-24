import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { Errors } from '@/lib/errors';

/**
 * @swagger
 * /api/campus/groups:
 *   get:
 *     summary: Get faculty to groups mapping
 *     description: >
 *       Returns the full faculty-to-groups mapping sourced from the campus API.
 *       Used to populate faculty/group pickers in the election creation form.
 *       Requires any authenticated user.
 *     tags:
 *       - Campus
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Faculty to groups mapping
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: array
 *                 items:
 *                   type: string
 *               example:
 *                 "Faculty of Engineering": ["Group A", "Group B"]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to fetch data from the campus API
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  try {
    const groups = await fetchFacultyGroups();
    return NextResponse.json(groups);
  } catch (err) {
    console.error('[campus/groups] fetch failed:', (err as Error).message);
    return Errors.internal('Failed to fetch faculty/group data from campus API');
  }
}
