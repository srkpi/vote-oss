import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import {
  BYPASS_TOKEN_LENGTH,
  BYPASS_TOKEN_MAX_COUNT,
  BYPASS_TOKEN_MAX_DAYS,
  BYPASS_TOKEN_MAX_USAGE_MAX,
  BYPASS_TOKEN_MIN_HOURS,
} from '@/lib/constants';
import { generateBase64Token } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/bypass:
 *   get:
 *     summary: List global bypass tokens
 *     description: >
 *       Returns all global bypass tokens visible to the caller, including
 *       soft-deleted ones for audit history. Non-restricted admins only.
 *     tags:
 *       - Bypass
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of global bypass tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   tokenHash:
 *                     type: string
 *                     description: SHA-256 hash of the token
 *                   bypassNotStudying:
 *                     type: boolean
 *                     description: Whether this token allows bypassing "not studying" status
 *                   bypassGraduate:
 *                     type: boolean
 *                     description: Whether this token allows bypassing "graduate" status
 *                   maxUsage:
 *                     type: integer
 *                     description: Maximum number of times this token can be used
 *                   currentUsage:
 *                     type: integer
 *                     description: Current number of times this token has been used
 *                   validUntil:
 *                     type: string
 *                     format: date-time
 *                     description: Expiration timestamp
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   deletedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     description: Soft-delete timestamp
 *                   creator:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                   usages:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         usedAt:
 *                           type: string
 *                           format: date-time
 *                         revokedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                   canDelete:
 *                     type: boolean
 *                     description: True if the current admin created the token or is an ancestor of the creator
 *                   canRevokeUsages:
 *                     type: boolean
 *                     description: True if the token is not soft-deleted
 *                 required:
 *                   - tokenHash
 *                   - bypassNotStudying
 *                   - bypassGraduate
 *                   - maxUsage
 *                   - currentUsage
 *                   - validUntil
 *                   - createdAt
 *                   - creator
 *                   - usages
 *                   - canDelete
 *                   - canRevokeUsages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – restricted admin
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  if (auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Only unrestricted admins can manage global bypass tokens');
  }

  const [tokens, adminGraph] = await Promise.all([
    prisma.globalBypassToken.findMany({
      // Return all tokens within the valid window — including soft-deleted —
      // so admins can see the full history.
      where: { valid_until: { gt: new Date() } },
      include: {
        creator: { select: { user_id: true, full_name: true } },
        usages: {
          select: { id: true, user_id: true, used_at: true, revoked_at: true },
          orderBy: { used_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    buildAdminGraph(),
  ]);

  const adminUserId = auth.admin.user_id;

  return NextResponse.json(
    tokens.map((t) => {
      const isCreator = t.created_by === adminUserId;
      const isAncestor = !isCreator && isAncestorInGraph(adminGraph, adminUserId, t.created_by);
      const isDeleted = !!t.deleted_at;
      return {
        tokenHash: t.token_hash,
        bypassNotStudying: t.bypass_not_studying,
        bypassGraduate: t.bypass_graduate,
        maxUsage: t.max_usage,
        currentUsage: t.current_usage,
        validUntil: t.valid_until.toISOString(),
        createdAt: t.created_at.toISOString(),
        deletedAt: t.deleted_at?.toISOString() ?? null,
        creator: { userId: t.creator.user_id, fullName: t.creator.full_name },
        usages: t.usages.map((u) => ({
          id: u.id,
          userId: u.user_id,
          usedAt: u.used_at.toISOString(),
          revokedAt: u.revoked_at?.toISOString() ?? null,
        })),
        canDelete: !isDeleted && (isCreator || isAncestor),
        canRevokeUsages: !isDeleted, // unrestricted admins can always revoke
      };
    }),
  );
}

/**
 * @swagger
 * /api/bypass:
 *   post:
 *     summary: Create a global bypass token
 *     description: >
 *       Creates a new global bypass token that allows a student to bypass
 *       platform-level access checks (not-studying status or graduate level).
 *       Only non-restricted admins can create global bypass tokens.
 *     tags:
 *       - Bypass
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - maxUsage
 *               - validUntil
 *             properties:
 *               bypassNotStudying:
 *                 type: boolean
 *                 description: Allow students with non-studying status to log in
 *               bypassGraduate:
 *                 type: boolean
 *                 description: Allow graduate students to access the platform
 *               maxUsage:
 *                 type: integer
 *                 minimum: 1
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Token created — raw token returned once
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – restricted admin
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  if (auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Only unrestricted admins can create global bypass tokens');
  }

  let body: {
    bypassNotStudying?: boolean;
    bypassGraduate?: boolean;
    maxUsage?: number;
    validUntil?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { bypassNotStudying = false, bypassGraduate = false, maxUsage, validUntil } = body;

  if (!bypassNotStudying && !bypassGraduate) {
    return Errors.badRequest(
      'At least one bypass option must be enabled (bypassNotStudying or bypassGraduate)',
    );
  }

  if (!validUntil) return Errors.badRequest('validUntil is required');

  const validUntilDate = new Date(validUntil);
  if (isNaN(validUntilDate.getTime())) return Errors.badRequest('Invalid validUntil date');

  const now = new Date();
  const minDate = new Date(now.getTime() + BYPASS_TOKEN_MIN_HOURS * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + BYPASS_TOKEN_MAX_DAYS * 24 * 60 * 60 * 1000);

  if (validUntilDate < minDate) {
    return Errors.badRequest(
      `validUntil must be at least ${BYPASS_TOKEN_MIN_HOURS} hour(s) in the future`,
    );
  }
  if (validUntilDate > maxDate) {
    return Errors.badRequest(`validUntil cannot exceed ${BYPASS_TOKEN_MAX_DAYS} days from now`);
  }

  if (!maxUsage || !Number.isInteger(maxUsage) || maxUsage < 1) {
    return Errors.badRequest('maxUsage must be a positive integer');
  }
  if (maxUsage > BYPASS_TOKEN_MAX_USAGE_MAX) {
    return Errors.badRequest(`maxUsage cannot exceed ${BYPASS_TOKEN_MAX_USAGE_MAX}`);
  }

  const activeCount = await prisma.globalBypassToken.count({
    where: { created_by: auth.user.sub, valid_until: { gt: now }, deleted_at: null },
  });

  if (activeCount >= BYPASS_TOKEN_MAX_COUNT) {
    return Errors.badRequest(
      `Cannot create more than ${BYPASS_TOKEN_MAX_COUNT} active bypass tokens`,
    );
  }

  const rawToken = generateBase64Token(BYPASS_TOKEN_LENGTH);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await prisma.globalBypassToken.create({
    data: {
      token_hash: tokenHash,
      bypass_not_studying: bypassNotStudying,
      bypass_graduate: bypassGraduate,
      max_usage: maxUsage,
      current_usage: 0,
      created_by: auth.user.sub,
      valid_until: validUntilDate,
    },
  });

  return NextResponse.json(
    {
      token: rawToken,
      tokenHash,
      bypassNotStudying,
      bypassGraduate,
      maxUsage,
      currentUsage: 0,
      validUntil: validUntilDate.toISOString(),
      deletedAt: null,
      canDelete: true,
      canRevokeUsages: true,
    },
    { status: 201 },
  );
}
