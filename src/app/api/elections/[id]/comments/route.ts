import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { getAdminUserIdSet, getPetitionGate, listComments, shapeComment } from '@/lib/comments';
import {
  COMMENT_MAX_LENGTH,
  COMMENTS_INITIAL_PAGE_SIZE,
  COMMENTS_LOAD_MORE_PAGE_SIZE,
} from '@/lib/constants';
import { encryptField } from '@/lib/encryption';
import { apiError, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { rateLimitComment } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/utils/common';
import type { CommentSort, CommentSortDirection } from '@/types/comment';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  if (cursor && !isValidUuid(cursor)) {
    return Errors.badRequest('Invalid cursor');
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : COMMENTS_INITIAL_PAGE_SIZE;
  if (!Number.isFinite(limit) || limit < 1) {
    return Errors.badRequest('Invalid limit');
  }
  if (limit > COMMENTS_LOAD_MORE_PAGE_SIZE) {
    return Errors.badRequest(`Limit should not be larger than ${COMMENTS_LOAD_MORE_PAGE_SIZE}`);
  }

  const sortParam = searchParams.get('sort');
  if (sortParam && sortParam !== 'date' && sortParam !== 'rating') {
    return Errors.badRequest("sort must be 'date' or 'rating'");
  }
  const sort: CommentSort = sortParam === 'rating' ? 'rating' : 'date';

  const directionParam = searchParams.get('direction');
  if (directionParam && directionParam !== 'asc' && directionParam !== 'desc') {
    return Errors.badRequest("direction must be 'asc' or 'desc'");
  }
  const direction: CommentSortDirection = directionParam === 'desc' ? 'desc' : 'asc';

  const result = await listComments(electionId, gate, auth.user.sub, {
    cursor,
    limit,
    sort,
    direction,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }
  if (gate.petition.commentsClosed) {
    return Errors.forbidden('Discussion is closed for this petition');
  }

  const limit = await rateLimitComment(auth.user.sub);
  if (limit.limited) {
    return NextResponse.json(
      { error: 'TooManyRequests', message: 'Too many comments, please slow down', statusCode: 429 },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetInMs / 1000)) } },
    );
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

  const [adminUserIds, avatarMap, created] = await Promise.all([
    getAdminUserIdSet([auth.user.sub]),
    getAvatarUrlMap([auth.user.sub]),
    prisma.comment.create({
      data: {
        election_id: electionId,
        user_id: auth.user.sub,
        full_name: encryptField(auth.user.fullName),
        body: text.trim(),
      },
    }),
  ]);

  return NextResponse.json(
    shapeComment(
      created,
      {
        petitionCreatedBy: gate.petition.createdBy,
        adminUserIds,
        requesterUserId: auth.user.sub,
        requesterIsPetitionManager: gate.isPetitionManager,
        myVotes: new Map(),
      },
      avatarMap,
    ),
    { status: 201 },
  );
}
