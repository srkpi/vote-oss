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
import { prisma } from '@/lib/prisma';

/**
 * GET /api/bypass
 * List all non-expired global bypass tokens (non-restricted admins only).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  if (auth.admin.restricted_to_faculty) {
    return Errors.forbidden('Only unrestricted admins can manage global bypass tokens');
  }

  const tokens = await prisma.bypassToken.findMany({
    where: { type: 'GLOBAL', valid_until: { gt: new Date() } },
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
      bypassNotStudying: t.bypass_not_studying,
      bypassGraduate: t.bypass_graduate,
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

/**
 * POST /api/bypass
 * Create a global bypass token (non-restricted admins only).
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

  // Must bypass at least one thing
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

  if (!maxUsage) {
    return Errors.badRequest('maxUsage must be provided');
  }
  if (!Number.isInteger(maxUsage) || maxUsage < 1) {
    return Errors.badRequest('maxUsage must be a positive integer');
  }
  if (maxUsage > BYPASS_TOKEN_MAX_USAGE_MAX) {
    return Errors.badRequest(`maxUsage cannot exceed ${BYPASS_TOKEN_MAX_USAGE_MAX}`);
  }

  const activeCount = await prisma.bypassToken.count({
    where: { created_by: auth.user.sub, type: 'GLOBAL', valid_until: { gt: now } },
  });

  if (activeCount >= BYPASS_TOKEN_MAX_COUNT) {
    return Errors.badRequest(
      `Cannot create more than ${BYPASS_TOKEN_MAX_COUNT} active bypass tokens`,
    );
  }

  const rawToken = generateBase64Token(BYPASS_TOKEN_LENGTH);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await prisma.bypassToken.create({
    data: {
      token_hash: tokenHash,
      type: 'GLOBAL',
      election_id: null,
      bypass_not_studying: bypassNotStudying,
      bypass_graduate: bypassGraduate,
      bypass_restrictions: [],
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
      maxUsage: maxUsage,
      currentUsage: 0,
      validUntil: validUntilDate.toISOString(),
    },
    { status: 201 },
  );
}
