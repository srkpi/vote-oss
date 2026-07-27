import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { getPetitionGate } from '@/lib/comments';
import { COMMENT_VOTERS_PAGE_SIZE } from '@/lib/constants';
import { safeDecrypt } from '@/lib/elections-view';
import { apiError, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/elections/{id}/comments/{commentId}/votes:
 *   get:
 *     summary: List who voted on a comment
 *     description: >
 *       Comment votes are not anonymous — returns each voter's name,
 *       direction, and timestamp, newest first. Avatars are resolved
 *       client-side via the app's avatar store, the same as everywhere
 *       else.
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
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Voter list plus current totals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentVotersResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Petition or comment not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId, commentId } = await params;
  if (!isValidUuid(electionId) || !isValidUuid(commentId)) return Errors.badRequest('Invalid id');

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) return apiError(gate.message, gate.status);

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, election_id: electionId },
    select: { id: true, up_count: true, down_count: true },
  });
  if (!comment) return Errors.notFound('Comment not found');

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  if (cursor && !isValidUuid(cursor)) return Errors.badRequest('Invalid cursor');

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : COMMENT_VOTERS_PAGE_SIZE;
  if (!Number.isFinite(limit) || limit < 1) return Errors.badRequest('Invalid limit');
  if (limit > COMMENT_VOTERS_PAGE_SIZE)
    return Errors.badRequest(`Limit should not be larger than ${COMMENT_VOTERS_PAGE_SIZE}`);

  const votes = await prisma.commentVote.findMany({
    where: { comment_id: commentId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = votes.length > limit;
  const page = hasMore ? votes.slice(0, limit) : votes;

  const avatarIds = new Set<string>();
  for (const v of page) {
    avatarIds.add(v.user_id);
  }
  const avatarMap = await getAvatarUrlMap([...avatarIds]);

  return NextResponse.json({
    voters: page.map((v) => ({
      userId: v.user_id,
      fullName: safeDecrypt(v.full_name),
      value: v.value,
      avatarUrl: avatarMap.get(v.user_id) ?? null,
      votedAt: v.created_at.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore,
    upCount: comment.up_count,
    downCount: comment.down_count,
  });
}
