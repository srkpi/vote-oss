import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { getUserOwnedGroups } from '@/lib/groups';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const groups = await getUserOwnedGroups(auth.user.sub);
  return NextResponse.json(groups);
}
