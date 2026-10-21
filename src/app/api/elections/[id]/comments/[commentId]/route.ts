import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { getAdminUserIdSet, getPetitionGate, shapeComment } from '@/lib/comments';
import { COMMENT_MAX_LENGTH } from '@/lib/constants';
import { encryptField } from '@/lib/encryption';
import { apiError, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

async function loadComment(electionId: string, commentId: string) {
  return prisma.comment.findFirst({ where: { id: commentId, election_id: electionId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: electionId, commentId } = await params;
  if (!isValidUuid(electionId) || !isValidUuid(commentId)) {
    return Errors.badRequest('Invalid id');
  }

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const existing = await loadComment(electionId, commentId);
  if (!existing || existing.deleted_at) {
    return Errors.notFound('Comment not found');
  }
  if (existing.user_id !== auth.user.sub) {
    return Errors.forbidden('You can only edit your own comment');
  }
  if (gate.petition.commentsClosed) {
    return Errors.forbidden('Discussion is closed for this petition');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }
  const text = (body as { body?: unknown })?.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return Errors.badRequest('Comment body is required');
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    return Errors.badRequest(`Comment must be at most ${COMMENT_MAX_LENGTH} characters`);
  }

  const [adminUserIds, avatarMap, updated] = await Promise.all([
    getAdminUserIdSet([existing.user_id]),
    getAvatarUrlMap([existing.user_id]),
    prisma.comment.update({
      where: { id: commentId },
      data: { body: text.trim(), edited_at: new Date() },
    }),
  ]);

  return NextResponse.json(
    shapeComment(
      updated,
      {
        petitionCreatedBy: gate.petition.createdBy,
        adminUserIds,
        requesterUserId: auth.user.sub,
        requesterIsPetitionManager: gate.isPetitionManager,
        myVotes: new Map(),
      },
      avatarMap,
    ),
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: electionId, commentId } = await params;
  if (!isValidUuid(electionId) || !isValidUuid(commentId)) {
    return Errors.badRequest('Invalid id');
  }

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const existing = await loadComment(electionId, commentId);
  if (!existing || existing.deleted_at) {
    return Errors.notFound('Comment not found');
  }

  const isOwnComment = existing.user_id === auth.user.sub;
  if (!isOwnComment && !gate.isPetitionManager) {
    return Errors.forbidden('You can only delete your own comment');
  }

  const avatarUserIds = isOwnComment ? [existing.user_id] : [existing.user_id, auth.user.sub];
  const [adminUserIds, avatarMap, updated] = await Promise.all([
    getAdminUserIdSet([existing.user_id]),
    getAvatarUrlMap(avatarUserIds),
    prisma.comment.update({
      where: { id: commentId },
      data: {
        deleted_at: new Date(),
        deleted_by: auth.user.sub,
        deleted_by_full_name: encryptField(auth.user.fullName),
      },
    }),
  ]);

  return NextResponse.json(
    shapeComment(
      updated,
      {
        petitionCreatedBy: gate.petition.createdBy,
        adminUserIds,
        requesterUserId: auth.user.sub,
        requesterIsPetitionManager: gate.isPetitionManager,
        myVotes: new Map(),
      },
      avatarMap,
    ),
  );
}
