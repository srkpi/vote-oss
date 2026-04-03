import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { COOKIE_RETURN_TO } from '@/lib/constants';

/**
 * @swagger
 * /api/auth/return-to:
 *   get:
 *     summary: Get post-login return path
 *     description: >
 *       Retrieves the `return_to` path stored in an HttpOnly cookie so the client
 *       can redirect the user after authentication. If a value is found, the cookie
 *       is cleared as part of this request.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Successfully retrieved the return path (or null if not set).
 *         headers:
 *           Set-Cookie:
 *             description: >
 *               Clears the `return_to` cookie if it existed by setting its max-age to 0.
 *             schema:
 *               type: string
 *               example: return_to=; Max-Age=0; Path=/;
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 returnTo:
 *                   type: string
 *                   nullable: true
 *                   description: >
 *                     The path the user should be redirected to after login.
 *                     Will be null if no cookie was set.
 *                   example: /elections
 *       500:
 *         description: Internal server error.
 */
export async function GET() {
  const cookieStore = await cookies();
  const returnTo = cookieStore.get(COOKIE_RETURN_TO)?.value ?? null;
  const response = NextResponse.json({ returnTo });

  if (returnTo) {
    response.cookies.set(COOKIE_RETURN_TO, '', { maxAge: 0, path: '/' });
  }

  return response;
}
