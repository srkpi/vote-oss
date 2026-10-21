import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { MAX_RESOLVE_AVATAR_URLS_PER_REQUEST } from '@/lib/constants';
import { Errors } from '@/lib/errors';

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
