import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import {
  BYPASS_TOKEN_LENGTH,
  BYPASS_TOKEN_MAX_COUNT,
  BYPASS_TOKEN_MAX_USAGE_MAX,
  BYPASSABLE_RESTRICTION_TYPES,
} from '@/lib/constants';
import { generateBase64Token } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { buildAdminGraph, isAncestorInGraph } from '@/lib/graph';
import { prisma } from '@/lib/prisma';
import { adminCanManageElectionBypass } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils/common';
import type { ElectionRestriction } from '@/types/election';

/**
 * @swagger
 * /api/elections/{id}/bypass:
 *   get:
 *     summary: List bypass tokens for an election
 *     description: >
 *       Returns ALL bypass tokens for the election — including soft-deleted
 *       ones — so admins can review the full access history.
 *       Soft-deleted tokens have a non-null `deletedAt` field and are shown
 *       with their complete usage records for audit purposes.
 *       The caller must be the election creator or a transitive ancestor
 *       in the admin hierarchy.
 *     tags:
 *       - Bypass
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Election UUID
 *     responses:
 *       200:
 *         description: Array of election bypass tokens (active and deleted)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ElectionBypassToken'
 *       400:
 *         description: Invalid election UUID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Election not found
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    select: { id: true, created_by: true },
  });
  if (!election) return Errors.notFound('Election not found');

  const adminGraph = await buildAdminGraph();
  if (!adminCanManageElectionBypass(auth.user.sub, election.created_by, adminGraph)) {
    return Errors.forbidden('You do not have permission to manage bypass tokens for this election');
  }

  const tokens = await prisma.electionBypassToken.findMany({
    where: { election_id: electionId },
    include: {
      creator: { select: { user_id: true, full_name: true } },
      deleter: { select: { user_id: true, full_name: true } },
      usages: {
        select: {
          id: true,
          user_id: true,
          used_at: true,
          revoked_at: true,
          revoker: { select: { user_id: true, full_name: true } },
        },
        orderBy: { used_at: 'desc' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const adminUserId = auth.admin.user_id;
  const isUnrestricted = !auth.admin.restricted_to_faculty;

  return NextResponse.json(
    tokens.map((t) => {
      const isCreator = t.created_by === adminUserId;
      const isAncestor = !isCreator && isAncestorInGraph(adminGraph, adminUserId, t.created_by);
      const isDeleted = !!t.deleted_at;
      return {
        tokenHash: t.token_hash,
        electionId: t.election_id,
        bypassRestrictions: t.bypass_restrictions,
        maxUsage: t.max_usage,
        currentUsage: t.current_usage,
        createdAt: t.created_at.toISOString(),
        deletedAt: t.deleted_at?.toISOString() ?? null,
        deletedBy: t.deleter ? { userId: t.deleter.user_id, fullName: t.deleter.full_name } : null,
        creator: { userId: t.creator.user_id, fullName: t.creator.full_name },
        usages: t.usages.map((u) => ({
          id: u.id,
          userId: u.user_id,
          usedAt: u.used_at.toISOString(),
          revokedAt: u.revoked_at?.toISOString() ?? null,
          revokedBy: u.revoker
            ? { userId: u.revoker.user_id, fullName: u.revoker.full_name }
            : null,
        })),
        canDelete: !isDeleted && (isCreator || isAncestor),
        canRevokeUsages: !isDeleted && (isUnrestricted || isCreator),
      };
    }),
  );
}

/**
 * @swagger
 * /api/elections/{id}/bypass:
 *   post:
 *     summary: Create an election bypass token
 *     description: >
 *       Creates a new election-scoped bypass token that grants the holder
 *       access to vote despite not meeting some of the election's restrictions.
 *       The token's validity is implicitly tied to the election's closes_at —
 *       no explicit validUntil is accepted. The caller must be the election
 *       creator or a transitive ancestor in the admin hierarchy.
 *     tags:
 *       - Bypass
 *       - Elections
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Election UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionBypassTokenCreateBody'
 *     responses:
 *       201:
 *         description: Bypass token created – raw token returned here only
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - token
 *                 - tokenHash
 *                 - electionId
 *                 - bypassRestrictions
 *                 - maxUsage
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Raw token to share with the student
 *                 tokenHash:
 *                   type: string
 *                   description: SHA-256 hash of the token
 *                 electionId:
 *                   type: string
 *                   format: uuid
 *                 bypassRestrictions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ElectionRestrictionType'
 *                 maxUsage:
 *                   type: integer
 *                   minimum: 1
 *                   description: Maximum number of times this token can be used
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Election not found
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const election = await prisma.election.findUnique({
    where: { id: electionId, deleted_at: null },
    include: { restrictions: { select: { type: true, value: true } } },
  });
  if (!election) return Errors.notFound('Election not found');

  if (election.restrictions.length === 0) {
    return Errors.badRequest(
      'Cannot create a bypass token for an election with no restrictions — all users already have access',
    );
  }

  const adminGraph = await buildAdminGraph();
  if (!adminCanManageElectionBypass(auth.user.sub, election.created_by, adminGraph)) {
    return Errors.forbidden('You do not have permission to create bypass tokens for this election');
  }

  let body: { bypassRestrictions?: string[]; maxUsage?: number };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { bypassRestrictions = [], maxUsage } = body;

  if (bypassRestrictions.length === 0) {
    return Errors.badRequest(
      'bypassRestrictions must contain at least one restriction type to bypass',
    );
  }

  for (const rt of bypassRestrictions) {
    if (
      !BYPASSABLE_RESTRICTION_TYPES.includes(rt as (typeof BYPASSABLE_RESTRICTION_TYPES)[number])
    ) {
      return Errors.badRequest(`Invalid restriction type: ${rt}`);
    }
  }

  const electionRestrictionTypes = new Set(
    (election.restrictions as ElectionRestriction[]).map((r) => r.type),
  );
  for (const rt of bypassRestrictions) {
    if (!electionRestrictionTypes.has(rt as ElectionRestriction['type'])) {
      return Errors.badRequest(
        `Restriction type "${rt}" is not present on this election and cannot be bypassed`,
      );
    }
  }

  if (!maxUsage || !Number.isInteger(maxUsage) || maxUsage < 1) {
    return Errors.badRequest('maxUsage must be a positive integer');
  }
  if (maxUsage > BYPASS_TOKEN_MAX_USAGE_MAX) {
    return Errors.badRequest(`maxUsage cannot exceed ${BYPASS_TOKEN_MAX_USAGE_MAX}`);
  }

  const activeCount = await prisma.electionBypassToken.count({
    where: { created_by: auth.user.sub, election_id: electionId, deleted_at: null },
  });

  if (activeCount >= BYPASS_TOKEN_MAX_COUNT) {
    return Errors.badRequest(
      `Cannot create more than ${BYPASS_TOKEN_MAX_COUNT} bypass tokens per election`,
    );
  }

  const rawToken = generateBase64Token(BYPASS_TOKEN_LENGTH);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await prisma.electionBypassToken.create({
    data: {
      token_hash: tokenHash,
      election_id: electionId,
      bypass_restrictions: bypassRestrictions,
      max_usage: maxUsage,
      current_usage: 0,
      created_by: auth.user.sub,
    },
  });

  return NextResponse.json(
    {
      token: rawToken,
      tokenHash,
      electionId,
      bypassRestrictions,
      maxUsage,
    },
    { status: 201 },
  );
}
