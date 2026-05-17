import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedInviteTokens, invalidateInviteTokens, setCachedInviteTokens } from '@/lib/cache';
import {
  INVITE_TOKEN_LENGTH,
  INVITE_TOKEN_MAX_COUNT,
  INVITE_TOKEN_MAX_VALID_DAYS,
} from '@/lib/constants';
import { generateBase64Token, hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';

/**
 * @swagger
 * /api/admins/invite:
 *   get:
 *     summary: List visible admin invite tokens
 *     description: >
 *       Returns all non-expired, non-exhausted invite tokens that the caller
 *       created or that were created by an admin in their subordinate
 *       hierarchy. As a side-effect, stale tokens (expired or exhausted) are
 *       hard-deleted from the database. Requires `manage_admins`.
 *     tags:
 *       - Admin Invites
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of visible invite tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InviteToken'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – caller does not have manage_admins
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_admins) {
    return Errors.forbidden('You do not have permission to view invite tokens');
  }

  const graph = await buildAdminGraph();
  let allTokens = await getCachedInviteTokens();

  if (!allTokens) {
    const dbTokens = await prisma.adminInviteToken.findMany({
      select: {
        token_hash: true,
        max_usage: true,
        current_usage: true,
        manage_admins: true,
        manage_groups: true,
        manage_petitions: true,
        manage_faq: true,
        restricted_to_faculty: true,
        valid_due: true,
        created_at: true,
        creator: { select: { user_id: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    allTokens = dbTokens.map((t) => ({
      tokenHash: t.token_hash,
      maxUsage: t.max_usage,
      currentUsage: t.current_usage,
      manageAdmins: t.manage_admins,
      manageGroups: t.manage_groups,
      managePetitions: t.manage_petitions,
      manageFaq: t.manage_faq,
      restrictedToFaculty: t.restricted_to_faculty,
      validDue: t.valid_due.toISOString(),
      createdAt: t.created_at.toISOString(),
      creator: { userId: t.creator.user_id, fullName: t.creator.full_name },
    }));

    await setCachedInviteTokens(allTokens);
  }

  // Purge stale tokens (expired or exhausted) from DB
  const now = new Date();
  const staleHashes = allTokens
    .filter((t) => new Date(t.validDue) < now || t.currentUsage >= t.maxUsage)
    .map((t) => t.tokenHash);

  if (staleHashes.length > 0) {
    await prisma.adminInviteToken.deleteMany({
      where: { token_hash: { in: staleHashes } },
    });
    await invalidateInviteTokens();
  }

  const freshTokens = allTokens.filter(
    (t) => new Date(t.validDue) >= now && t.currentUsage < t.maxUsage,
  );

  // Filter by caller's hierarchy and attach computed flags
  const visible = freshTokens
    .filter(
      (t) => t.creator.userId === user.sub || isAncestorInGraph(graph, user.sub, t.creator.userId),
    )
    .map((t) => ({
      ...t,
      isOwn: t.creator.userId === user.sub,
      deletable: true,
    }));

  return NextResponse.json(visible);
}

/**
 * @swagger
 * /api/admins/invite:
 *   post:
 *     summary: Create an admin invite token
 *     description: >
 *       Generates a new admin invite token with the specified permissions and
 *       validity. The raw plaintext token is returned exactly once and is
 *       never stored; only its SHA-256 hash is persisted. Requires
 *       `manage_admins`. A caller may hold at most `INVITE_TOKEN_MAX_COUNT`
 *       active tokens at a time.
 *
 *       Permission constraints:
 *         - A caller may only grant permission flags they themselves hold
 *           (e.g. cannot grant `manageGroups` without having `manageGroups`).
 *         - A faculty-restricted caller always creates faculty-restricted tokens
 *           regardless of the `restrictedToFaculty` field in the request body.
 *     tags:
 *       - Admin Invites
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteTokenCreateBody'
 *     responses:
 *       201:
 *         description: Token created – raw token returned here only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - token
 *                 - maxUsage
 *                 - manageAdmins
 *                 - manageGroups
 *                 - managePetitions
 *                 - manageFaq
 *                 - restrictedToFaculty
 *                 - validDue
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Raw (unhashed) invite token. Share this with the invitee; it is not stored on the server.
 *                 maxUsage:
 *                   type: integer
 *                 manageAdmins:
 *                   type: boolean
 *                 manageGroups:
 *                   type: boolean
 *                 managePetitions:
 *                   type: boolean
 *                 manageFaq:
 *                   type: boolean
 *                 restrictedToFaculty:
 *                   type: boolean
 *                 validDue:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error, missing validDue, invalid date, or token limit reached
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: >
 *           Caller lacks manage_admins, or is attempting to grant a permission
 *           they do not hold themselves.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_admins) {
    return Errors.forbidden('You do not have permission to create admin invites');
  }

  let body: {
    maxUsage?: number;
    manageAdmins?: boolean;
    manageGroups?: boolean;
    managePetitions?: boolean;
    manageFaq?: boolean;
    restrictedToFaculty?: boolean;
    validDue?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const {
    maxUsage = 1,
    manageAdmins = false,
    manageGroups = false,
    managePetitions = false,
    manageFaq = false,
    validDue,
  } = body;
  let { restrictedToFaculty = true } = body;

  if (!validDue) return Errors.badRequest('validDue is required');

  const validDueDate = new Date(validDue);
  if (isNaN(validDueDate.getTime()) || validDueDate <= new Date()) {
    return Errors.badRequest('validDue must be a future date');
  }

  const maxValidDue = new Date(Date.now() + INVITE_TOKEN_MAX_VALID_DAYS * 24 * 60 * 60 * 1_000);
  if (validDueDate > maxValidDue) {
    return Errors.badRequest(
      `validDue cannot be more than ${INVITE_TOKEN_MAX_VALID_DAYS} days in the future`,
    );
  }

  if (maxUsage < 1 || maxUsage > 100) {
    return Errors.badRequest('maxUsage must be between 1 and 100');
  }

  if (manageAdmins && !admin.manage_admins) {
    return Errors.forbidden('Cannot grant manage_admins permission you do not have');
  }

  // manage_groups can only be granted by admins who themselves have manage_groups
  if (manageGroups && !admin.manage_groups) {
    return Errors.forbidden('Cannot grant manage_groups permission you do not have');
  }

  // manage_petitions can only be granted by admins who themselves have manage_petitions
  if (managePetitions && !admin.manage_petitions) {
    return Errors.forbidden('Cannot grant manage_petitions permission you do not have');
  }

  // manage_faq can only be granted by admins who themselves have manage_faq
  if (manageFaq && !admin.manage_faq) {
    return Errors.forbidden('Cannot grant manage_faq permission you do not have');
  }

  if (admin.restricted_to_faculty) {
    restrictedToFaculty = true;
  }

  // Enforce per-admin active token limit
  const now = new Date();
  const activeTokenCount = await prisma.adminInviteToken.count({
    where: {
      created_by: user.sub,
      valid_due: { gt: now },
    },
  });

  if (activeTokenCount >= INVITE_TOKEN_MAX_COUNT) {
    return Errors.badRequest(
      `Cannot create more than ${INVITE_TOKEN_MAX_COUNT} active invite tokens`,
    );
  }

  const rawToken = generateBase64Token(INVITE_TOKEN_LENGTH);
  const tokenHash = hashToken(rawToken);

  await prisma.adminInviteToken.create({
    data: {
      token_hash: tokenHash,
      max_usage: maxUsage,
      current_usage: 0,
      manage_admins: manageAdmins,
      manage_groups: manageGroups,
      manage_petitions: managePetitions,
      manage_faq: manageFaq,
      restricted_to_faculty: restrictedToFaculty,
      valid_due: validDueDate,
      created_at: now,
      created_by: user.sub,
    },
  });

  await invalidateInviteTokens();

  return NextResponse.json(
    {
      token: rawToken,
      maxUsage,
      manageAdmins,
      manageGroups,
      managePetitions,
      manageFaq,
      restrictedToFaculty,
      validDue: validDueDate,
    },
    { status: 201 },
  );
}
