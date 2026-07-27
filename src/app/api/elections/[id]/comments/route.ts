import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { getAdminUserIdSet, getPetitionGate, shapeComment } from '@/lib/comments';
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

/**
 * @swagger
 * /api/elections/{id}/comments:
 *   get:
 *     summary: List comments on a petition (cursor-paginated, newest first)
 *     description: >
 *       Returns a page of top-level comments, newest first. Pass `cursor`
 *       (the `id` of the last comment already loaded) to fetch the next
 *       page. Defaults to 5 for the first page; pass a larger `limit`
 *       (capped at 20) for "load more" requests.
 *
 *       Each comment reports whether the requester may edit/delete it,
 *       whether its author is the petition's creator or a current admin,
 *       and the requester's own vote on it, if any.
 *     tags:
 *       - Petition comments
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Petition UUID
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Id of the last comment already loaded
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page size (default 5 for the first page)
 *     responses:
 *       200:
 *         description: A page of comments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentsListResponse'
 *       400:
 *         description: Invalid UUID, invalid cursor, or not a petition
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Petition not found (or not visible to the caller)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) return apiError(gate.message, gate.status);

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  if (cursor && !isValidUuid(cursor)) return Errors.badRequest('Invalid cursor');

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : COMMENTS_INITIAL_PAGE_SIZE;
  if (!Number.isFinite(limit) || limit < 1) return Errors.badRequest('Invalid limit');
  if (limit > COMMENTS_LOAD_MORE_PAGE_SIZE)
    return Errors.badRequest(`Limit should not be larger than ${COMMENTS_LOAD_MORE_PAGE_SIZE}`);

  const rows = await prisma.comment.findMany({
    where: { election_id: electionId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const avatarIds = new Set<string>();
  for (const row of page) {
    avatarIds.add(row.user_id);
    if (row.deleted_by) avatarIds.add(row.deleted_by);
  }

  const [adminUserIds, avatarMap, myVoteRows] = await Promise.all([
    getAdminUserIdSet([...new Set(page.map((c) => c.user_id))]),
    getAvatarUrlMap([...avatarIds]),
    prisma.commentVote.findMany({
      where: { comment_id: { in: page.map((c) => c.id) }, user_id: auth.user.sub },
      select: { comment_id: true, value: true },
    }),
  ]);

  const myVotes = new Map(myVoteRows.map((v) => [v.comment_id, v.value]));

  const comments = page.map((row) =>
    shapeComment(
      row,
      {
        petitionCreatedBy: gate.petition.createdBy,
        adminUserIds,
        requesterUserId: auth.user.sub,
        requesterIsPetitionManager: gate.isPetitionManager,
        myVotes,
      },
      avatarMap,
    ),
  );

  return NextResponse.json({
    comments,
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore,
  });
}

/**
 * @swagger
 * /api/elections/{id}/comments:
 *   post:
 *     summary: Post a new top-level comment on a petition
 *     description: >
 *       Plain text only — the client applies the app's linkify helper for
 *       display, no HTML/markdown is interpreted server-side. Returns 403
 *       when an admin has closed the petition's discussion.
 *     tags:
 *       - Petition comments
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentCreateBody'
 *     responses:
 *       201:
 *         description: The created comment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Empty comment, comment too long, or invalid body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Discussion is closed
 *       404:
 *         description: Petition not found
 *       429:
 *         description: Too many comments posted recently
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) return Errors.badRequest('Invalid election id');

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) return apiError(gate.message, gate.status);
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
