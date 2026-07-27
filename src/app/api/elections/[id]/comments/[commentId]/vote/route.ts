import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { getPetitionGate } from '@/lib/comments';
import { encryptField } from '@/lib/encryption';
import { apiError, Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { rateLimitCommentVote } from '@/lib/rate-limit';
import { isValidUuid } from '@/lib/utils/common';

const VALID_VALUES = new Set(['UP', 'DOWN']);

async function loadVotableComment(electionId: string, commentId: string) {
  return prisma.comment.findFirst({
    where: { id: commentId, election_id: electionId },
    select: { id: true, user_id: true, deleted_at: true },
  });
}

/**
 * @swagger
 * /api/elections/{id}/comments/{commentId}/vote:
 *   put:
 *     summary: Cast or change your vote on a comment
 *     description: >
 *       Idempotent set: call again with a different value to switch your
 *       vote. Comment votes are **not** anonymous — your name is visible
 *       to anyone who opens the "who voted" list on this comment. Voting
 *       stays open even while the petition's discussion is closed. You
 *       cannot vote on your own comment.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentVoteBody'
 *     responses:
 *       200:
 *         description: Updated vote totals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentVoteSummary'
 *       400:
 *         description: Invalid value, or voting on your own comment
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Petition or comment not found
 *       429:
 *         description: Too many vote changes recently
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId, commentId } = await params;
  if (!isValidUuid(electionId) || !isValidUuid(commentId)) return Errors.badRequest('Invalid id');

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) return apiError(gate.message, gate.status);

  const comment = await loadVotableComment(electionId, commentId);
  if (!comment || comment.deleted_at) return Errors.notFound('Comment not found');
  if (comment.user_id === auth.user.sub)
    return Errors.badRequest('You cannot vote on your own comment');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }
  const value = (body as { value?: unknown })?.value;
  if (typeof value !== 'string' || !VALID_VALUES.has(value)) {
    return Errors.badRequest("value must be 'UP' or 'DOWN'");
  }
  const typedValue = value as 'UP' | 'DOWN';

  const limit = await rateLimitCommentVote(auth.user.sub);
  if (limit.limited) {
    return NextResponse.json(
      {
        error: 'TooManyRequests',
        message: 'Too many vote changes, please slow down',
        statusCode: 429,
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetInMs / 1000)) } },
    );
  }

  const encryptedName = encryptField(auth.user.fullName);

  try {
    await prisma.$transaction(async (tx) => {
      const existingVote = await tx.commentVote.findUnique({
        where: { comment_id_user_id: { comment_id: commentId, user_id: auth.user.sub } },
      });

      if (existingVote && existingVote.value === typedValue) {
        // Same value again
        return;
      }

      if (existingVote) {
        await tx.commentVote.update({
          where: { id: existingVote.id },
          data: { value: typedValue, full_name: encryptedName, created_at: new Date() },
        });
        await tx.comment.update({
          where: { id: commentId },
          data:
            typedValue === 'UP'
              ? { up_count: { increment: 1 }, down_count: { decrement: 1 } }
              : { down_count: { increment: 1 }, up_count: { decrement: 1 } },
        });
      } else {
        await tx.commentVote.create({
          data: {
            comment_id: commentId,
            user_id: auth.user.sub,
            full_name: encryptedName,
            value: typedValue,
          },
        });
        await tx.comment.update({
          where: { id: commentId },
          data:
            typedValue === 'UP' ? { up_count: { increment: 1 } } : { down_count: { increment: 1 } },
        });
      }
    });
  } catch (err) {
    // Concurrent duplicate request for the same user/comment (e.g. a
    // double-click) — safe to ignore, fall through and report current state.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
  }

  const fresh = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    select: { up_count: true, down_count: true },
  });

  return NextResponse.json({
    upCount: fresh.up_count,
    downCount: fresh.down_count,
    myVote: typedValue,
  });
}

/**
 * @swagger
 * /api/elections/{id}/comments/{commentId}/vote:
 *   delete:
 *     summary: Revoke your vote on a comment
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
 *     responses:
 *       200:
 *         description: Updated vote totals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentVoteSummary'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Petition, comment, or existing vote not found
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: electionId, commentId } = await params;
  if (!isValidUuid(electionId) || !isValidUuid(commentId)) return Errors.badRequest('Invalid id');

  const gate = await getPetitionGate(electionId, auth.user);
  if (!gate.ok) return apiError(gate.message, gate.status);

  const comment = await loadVotableComment(electionId, commentId);
  if (!comment || comment.deleted_at) return Errors.notFound('Comment not found');

  const deletedVote = await prisma.$transaction(async (tx) => {
    const existingVote = await tx.commentVote.findUnique({
      where: { comment_id_user_id: { comment_id: commentId, user_id: auth.user.sub } },
    });
    if (!existingVote) return null;

    await tx.commentVote.delete({ where: { id: existingVote.id } });
    await tx.comment.update({
      where: { id: commentId },
      data:
        existingVote.value === 'UP'
          ? { up_count: { decrement: 1 } }
          : { down_count: { decrement: 1 } },
    });
    return existingVote;
  });

  if (!deletedVote) return Errors.notFound('You have not voted on this comment');

  const fresh = await prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    select: { up_count: true, down_count: true },
  });

  return NextResponse.json({ upCount: fresh.up_count, downCount: fresh.down_count, myVote: null });
}
