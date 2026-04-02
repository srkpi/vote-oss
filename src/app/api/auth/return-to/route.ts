import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { COOKIE_RETURN_TO } from '@/lib/constants';

export const runtime = 'edge';

/**
 * GET /api/auth/return-to
 * Returns the stored return_to path (from the HttpOnly cookie) so the
 * client-side callback page can redirect appropriately after login.
 * Also clears the cookie.
 */
export async function GET() {
  const cookieStore = await cookies();
  const returnTo = cookieStore.get(COOKIE_RETURN_TO)?.value ?? null;
  const response = NextResponse.json({ returnTo });

  if (returnTo) {
    // Clear the cookie now that it has been consumed
    response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });
  }

  return response;
}
