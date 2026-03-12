import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { Errors } from '@/lib/errors';

/**
 * GET /api/campus/groups
 *
 * Returns the full faculty → groups mapping used to populate the
 * faculty/group pickers in the election creation form.
 *
 * Response shape: `Record<string, string[]>`
 * Keys are sorted faculty names; values are groups sorted alphabetically.
 *
 * Requires authentication (any logged-in user).
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
