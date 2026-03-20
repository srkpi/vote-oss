import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getCachedInviteTokens, invalidateInviteTokens, setCachedInviteTokens } from '@/lib/cache';
import {
  INVITE_TOKEN_LENGTH,
  INVITE_TOKEN_MAX_COUNT,
  INVITE_TOKEN_MAX_VALID_DAYS,
} from '@/lib/constants';
import { generateBase64Token, hashToken } from '@/lib/crypto';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isAncestorInGraph } from '@/lib/utils';

// ---------------------------------------------------------------------------
// GET /api/admins/invite
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_admins) {
    return Errors.forbidden('You do not have permission to view invite tokens');
  }

  // ── Load hierarchy graph (single query, includes soft-deleted nodes) ──────
  const graphNodes = await prisma.admin.findMany({
    select: { user_id: true, promoted_by: true },
  });
  const graph = new Map(graphNodes.map((n) => [n.user_id, n.promoted_by]));

  // ── Resolve token list from cache or DB ───────────────────────────────────
  let allTokens = await getCachedInviteTokens();

  if (!allTokens) {
    const dbTokens = await prisma.adminInviteToken.findMany({
      select: {
        token_hash: true,
        max_usage: true,
        current_usage: true,
        manage_admins: true,
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
      restrictedToFaculty: t.restricted_to_faculty,
      validDue: t.valid_due.toISOString(),
      createdAt: t.created_at.toISOString(),
      creator: { userId: t.creator.user_id, fullName: t.creator.full_name },
    }));

    await setCachedInviteTokens(allTokens);
  }

  // ── Purge stale tokens (expired or exhausted) from DB ────────────────────
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

  // ── Keep only fresh tokens ────────────────────────────────────────────────
  const freshTokens = allTokens.filter(
    (t) => new Date(t.validDue) >= now && t.currentUsage < t.maxUsage,
  );

  // ── Filter by caller's hierarchy and attach computed flags ────────────────
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

// ---------------------------------------------------------------------------
// POST /api/admins/invite
// ---------------------------------------------------------------------------

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
    restrictedToFaculty?: boolean;
    validDue?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const { maxUsage = 1, manageAdmins = false, validDue } = body;
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

  if (admin.restricted_to_faculty) {
    restrictedToFaculty = true;
  }

  // ── Enforce per-admin active token limit ──────────────────────────────────
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
      restrictedToFaculty,
      validDue: validDueDate,
    },
    { status: 201 },
  );
}
