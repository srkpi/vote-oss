import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { parseRequestBody } from '@/lib/api/request';
import { requireAdmin } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
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
import { adminInviteBodySchema } from '@/lib/schemas/group';

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

  const avatarMap = await getAvatarUrlMap(visible.map((t) => t.creator.userId));

  return NextResponse.json(
    visible.map((t) => ({
      ...t,
      creator: { ...t.creator, avatarUrl: avatarMap.get(t.creator.userId) ?? null },
    })),
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return auth.status === 401 ? Errors.unauthorized(auth.error) : Errors.forbidden(auth.error);
  }

  const { admin, user } = auth;

  if (!admin.manage_admins) {
    return Errors.forbidden('You do not have permission to create admin invites');
  }

  const parsedBody = await parseRequestBody(req, adminInviteBodySchema);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const {
    maxUsage = 1,
    manageAdmins = false,
    manageGroups = false,
    managePetitions = false,
    manageFaq = false,
    validDue,
  } = body;
  let { restrictedToFaculty = true } = body;

  if (!validDue) {
    return Errors.badRequest('validDue is required');
  }

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
