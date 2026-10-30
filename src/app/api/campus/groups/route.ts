import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { fetchFacultyGroups } from '@/lib/campus-api';
import { Errors } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  try {
    const groups = await fetchFacultyGroups();
    return NextResponse.json(groups);
  } catch (err) {
    console.error('[campus/groups] fetch failed:', (err as Error).message);
    return Errors.internal('Failed to fetch faculty/group data from campus API');
  }
}
