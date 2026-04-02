import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedAdmins } from '@/lib/cache';
import {
  BYPASS_TOKEN_LENGTH,
  BYPASS_TOKEN_MAX_COUNT,
  BYPASS_TOKEN_MAX_DAYS,
  BYPASS_TOKEN_MAX_USAGE_MAX,
  BYPASS_TOKEN_MIN_HOURS,
} from '@/lib/constants';
import { generateBase64Token } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { adminCanManageElectionBypass } from '@/lib/restrictions';
import { isValidUuid } from '@/lib/utils';
import type { ElectionRestriction } from '@/types/election';

const BYPASSABLE_RESTRICTION_TYPES = [
  'FACULTY',
  'GROUP',
  'STUDY_YEAR',
  'STUDY_FORM',
  'LEVEL_COURSE',
  'SPECIALITY',
] as const;

async function buildAdminGraph(): Promise<Map<string, string | null>> {
  const cached = await getCachedAdmins();
  if (cached) return new Map(cached.map((a) => [a.userId, a.promoter?.userId ?? null]));
  const admins = await prisma.admin.findMany({
    where: { deleted_at: null },
    select: { user_id: true, promoted_by: true },
  });
  return new Map(admins.map((a) => [a.user_id, a.promoted_by]));
}

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

  const tokens = await prisma.bypassToken.findMany({
    where: { type: 'ELECTION', election_id: electionId, valid_until: { gt: new Date() } },
    include: {
      creator: { select: { user_id: true, full_name: true } },
      usages: {
        select: { id: true, user_id: true, used_at: true, revoked_at: true },
        orderBy: { used_at: 'desc' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(
    tokens.map((t) => ({
      tokenHash: t.token_hash,
      type: t.type,
      electionId: t.election_id,
      bypassNotStudying: false,
      bypassGraduate: false,
      bypassRestrictions: t.bypass_restrictions,
      maxUsage: t.max_usage,
      currentUsage: t.current_usage,
      validUntil: t.valid_until.toISOString(),
      createdAt: t.created_at.toISOString(),
      creator: { userId: t.creator.user_id, fullName: t.creator.full_name },
      usages: t.usages.map((u) => ({
        id: u.id,
        userId: u.user_id,
        usedAt: u.used_at.toISOString(),
        revokedAt: u.revoked_at?.toISOString() ?? null,
      })),
    })),
  );
}

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

  let body: {
    bypassRestrictions?: string[];
    maxUsage?: number;
    validUntil?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { bypassRestrictions = [], maxUsage, validUntil } = body;

  // Must bypass at least one restriction type
  if (bypassRestrictions.length === 0) {
    return Errors.badRequest(
      'bypassRestrictions must contain at least one restriction type to bypass',
    );
  }

  // Validate each type is a known bypassable type
  for (const rt of bypassRestrictions) {
    if (
      !BYPASSABLE_RESTRICTION_TYPES.includes(rt as (typeof BYPASSABLE_RESTRICTION_TYPES)[number])
    ) {
      return Errors.badRequest(`Invalid restriction type: ${rt}`);
    }
  }

  // Validate each type actually exists on this election
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

  if (!maxUsage) {
    return Errors.badRequest('maxUsage must be provided');
  }
  if (!maxUsage || !Number.isInteger(maxUsage) || maxUsage < 1) {
    return Errors.badRequest('maxUsage must be a positive integer');
  }
  if (maxUsage > BYPASS_TOKEN_MAX_USAGE_MAX) {
    return Errors.badRequest(`maxUsage cannot exceed ${BYPASS_TOKEN_MAX_USAGE_MAX}`);
  }

  const activeCount = await prisma.bypassToken.count({
    where: {
      created_by: auth.user.sub,
      type: 'ELECTION',
      election_id: electionId,
      valid_until: { gt: now },
    },
  });

  if (activeCount >= BYPASS_TOKEN_MAX_COUNT) {
    return Errors.badRequest(
      `Cannot create more than ${BYPASS_TOKEN_MAX_COUNT} active bypass tokens per election`,
    );
  }

  const rawToken = generateBase64Token(BYPASS_TOKEN_LENGTH);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await prisma.bypassToken.create({
    data: {
      token_hash: tokenHash,
      type: 'ELECTION',
      election_id: electionId,
      bypass_not_studying: false,
      bypass_graduate: false,
      bypass_restrictions: bypassRestrictions,
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
      electionId,
      bypassRestrictions,
      maxUsage: maxUsage ?? null,
      currentUsage: 0,
      validUntil: validUntilDate.toISOString(),
    },
    { status: 201 },
  );
}
