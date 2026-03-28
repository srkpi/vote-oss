import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { invalidateAdmins, invalidateInviteTokens } from '@/lib/cache';
import { hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/admins/join:
 *   post:
 *     summary: Become an admin via invite token
 *     description: >
 *       Redeems a valid invite token for the currently authenticated user,
 *       creating or reactivating their admin record. If the token reaches its
 *       maximum usage after this redemption it is automatically deleted.
 *       Any logged-in user (non-admin included) may call this endpoint.
 *     tags:
 *       - Admins
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Raw (unhashed) invite token received from an existing admin
 *     responses:
 *       201:
 *         description: Admin record created or reactivated
 *       400:
 *         description: Missing token, expired token, or token usage limit reached
 *       401:
 *         description: Unauthorized – user is not logged in
 *       404:
 *         description: Invalid invite token
 *       409:
 *         description: User is already an active admin
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { user } = auth;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return Errors.badRequest('token is required');
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const inviteToken = await prisma.adminInviteToken.findUnique({
    where: { token_hash: tokenHash },
    include: { creator: true },
  });

  if (!inviteToken) return Errors.notFound('Invalid invite token');
  if (inviteToken.valid_due < now) return Errors.badRequest('Invite token has expired');
  if (inviteToken.current_usage >= inviteToken.max_usage) {
    return Errors.badRequest('Invite token has reached its maximum usage');
  }

  const existingAdmin = await prisma.admin.findUnique({ where: { user_id: user.sub } });

  if (existingAdmin) {
    if (existingAdmin.deleted_at === null) {
      // Active admin — cannot join again.
      return Errors.conflict('You are already an admin');
    }

    await prisma.$transaction([
      prisma.admin.update({
        where: { user_id: user.sub },
        data: {
          promoted_by: inviteToken.created_by,
          promoted_at: now,
          manage_admins: inviteToken.manage_admins,
          restricted_to_faculty: inviteToken.restricted_to_faculty,
          deleted_at: null,
          deleted_by: null,
        },
      }),
      prisma.adminInviteToken.update({
        where: { token_hash: tokenHash },
        data: { current_usage: { increment: 1 } },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.admin.create({
        data: {
          user_id: user.sub,
          full_name: user.fullName,
          group: user.group,
          faculty: user.faculty,
          promoted_by: inviteToken.created_by,
          promoted_at: now,
          manage_admins: inviteToken.manage_admins,
          restricted_to_faculty: inviteToken.restricted_to_faculty,
        },
      }),
      prisma.adminInviteToken.update({
        where: { token_hash: tokenHash },
        data: { current_usage: { increment: 1 } },
      }),
    ]);
  }

  // ── Auto-delete exhausted token (fire-and-forget, non-critical) ───────────
  // current_usage before increment + 1 equals the new usage after the transaction.
  const newUsage = inviteToken.current_usage + 1;
  if (newUsage >= inviteToken.max_usage) {
    try {
      await prisma.adminInviteToken.delete({ where: { token_hash: tokenHash } });
    } catch {
      // Token may already have been deleted by a concurrent request — ignore
    }
    await invalidateInviteTokens();
  }

  await invalidateAdmins();

  return new NextResponse(null, { status: 201 });
}
