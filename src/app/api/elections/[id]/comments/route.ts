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

/**
 * @swagger
 * /api/elections/{id}/comments:
 *   get:
 *     summary: List comments on a petition (cursor-paginated, sortable)
 *     description: >
 *       Returns a page of top-level comments. Defaults to `sort=date`,
 *       `direction=asc` (oldest first), so reading top-to-bottom follows
 *       the natural flow of the discussion. Pass `cursor` (the `id` of
 *       the last comment already loaded) to fetch the next page,
 *       continuing in the same sort order. Defaults to 5 for the first
 *       page; pass a larger `limit` (capped at 20) for "load more"
 *       requests.
 *
 *       `sort=rating` orders by net score (upvotes minus downvotes)
 *       instead of by date. `direction` reverses whichever sort is
 *       active; changing either one starts a new sequence, so the client
 *       should re-fetch with `cursor` omitted rather than reuse an old
 *       cursor from a different sort.
 *
 *       Each comment reports whether the requester may edit/delete it,
 *       whether its author is the petition's creator or a current admin,
 *       and the requester's own vote on it, if any.
 *
 *       The petition detail endpoint (GET /elections/{id}) already embeds
 *       the default first page (oldest first) as `initialComments` — call
 *       this endpoint for "load more" and whenever the requested sort
 *       differs from that default.
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [date, rating]
 *         description: Sort field. Defaults to `date`.
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction. Defaults to `asc` (oldest/lowest-rated first).
 *     responses:
 *       200:
 *         description: A page of comments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentsListResponse'
 *       400:
 *         description: >
 *           Invalid UUID, invalid cursor, not a petition, or an
 *           unrecognized `sort`/`direction` value
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
