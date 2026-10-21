import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { getAvatarUrlMap } from '@/lib/avatars';
import { PETITION_OFFICIAL_ANSWER_MAX_LENGTH } from '@/lib/constants';
import { safeDecrypt } from '@/lib/elections-view';
import { encryptField } from '@/lib/encryption';
import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { isValidUuid } from '@/lib/utils/common';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }
  if (!auth.admin.manage_petitions) {
    return Errors.forbidden('Requires manage_petitions');
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { type: true, deleted_at: true },
  });
  if (!election || election.deleted_at) {
    return Errors.notFound('Petition not found');
  }
  if (election.type !== 'PETITION') {
    return Errors.badRequest('Only available for petitions');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }
  const text = (body as { body?: unknown })?.body;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return Errors.badRequest('Answer body is required');
  }
  if (text.length > PETITION_OFFICIAL_ANSWER_MAX_LENGTH) {
    return Errors.badRequest(
      `Answer must be at most ${PETITION_OFFICIAL_ANSWER_MAX_LENGTH} characters`,
    );
  }

  const encryptedName = encryptField(auth.user.fullName);
  const saved = await prisma.petitionOfficialAnswer.upsert({
    where: { election_id: electionId },
    update: {
      body: text.trim(),
      edited_at: new Date(),
      edited_by_user_id: auth.user.sub,
      edited_by_full_name: encryptedName,
    },
    create: {
      election_id: electionId,
      body: text.trim(),
      author_user_id: auth.user.sub,
      author_full_name: encryptedName,
    },
  });

  const avatarIds =
    auth.user.sub !== saved.author_user_id
      ? [saved.author_user_id, auth.user.sub]
      : [auth.user.sub];
  const avatarMap = await getAvatarUrlMap(avatarIds);

  return NextResponse.json({
    body: saved.body,
    createdAt: saved.created_at.toISOString(),
    author: {
      userId: saved.author_user_id,
      fullName: safeDecrypt(saved.author_full_name),
      avatarUrl: avatarMap.get(saved.author_user_id) ?? null,
    },
    editedAt: saved.edited_at ? saved.edited_at.toISOString() : null,
    editedBy: saved.edited_by_user_id
      ? {
          userId: saved.edited_by_user_id,
          fullName: safeDecrypt(saved.edited_by_full_name ?? ''),
          avatarUrl: avatarMap.get(saved.edited_by_user_id) ?? null,
        }
      : null,
    canManage: true,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }
  if (!auth.admin.manage_petitions) {
    return Errors.forbidden('Requires manage_petitions');
  }

  const { id: electionId } = await params;
  if (!isValidUuid(electionId)) {
    return Errors.badRequest('Invalid election id');
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { type: true },
  });
  if (!election) {
    return Errors.notFound('Petition not found');
  }
  if (election.type !== 'PETITION') {
    return Errors.badRequest('Only available for petitions');
  }

  try {
    await prisma.petitionOfficialAnswer.delete({
      where: { election_id: electionId },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // P2025: Record to delete does not exist
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Errors.notFound('No official answer to remove');
    }
    throw error; // Re-throw any other unexpected errors
  }
}
