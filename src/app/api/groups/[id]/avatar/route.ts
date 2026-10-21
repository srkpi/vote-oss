import { createHash, randomUUID } from 'crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import {
  AvatarValidationError,
  processAvatarImage,
  statusForAvatarError,
} from '@/lib/avatar-image';
import { FILE_ORIGINAL_NAME_MAX_LENGTH } from '@/lib/constants';
import { apiError, Errors } from '@/lib/errors';
import { shapeFileSummary } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { rateLimitAvatarUpload } from '@/lib/rate-limit';
import { PUBLIC_BUCKET, putObject, removeObject } from '@/lib/storage/minio';
import { isValidUuid } from '@/lib/utils/common';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) {
    return Errors.badRequest('Invalid group id');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, owner_id: true, deleted_at: true, logo_file_id: true },
  });
  if (!group || group.deleted_at) {
    return Errors.notFound('Group not found');
  }
  if (group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can change the logo');
  }

  const limit = await rateLimitAvatarUpload(auth.user.sub);
  if (limit.limited) {
    return NextResponse.json(
      {
        error: 'TooManyRequests',
        message: 'Too many logo uploads, try again shortly',
        statusCode: 429,
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.resetInMs / 1000)) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Errors.badRequest('Expected multipart/form-data body');
  }

  const entry = form.get('file');
  if (!(entry instanceof File)) {
    return Errors.badRequest('Field "file" is required and must be a file');
  }

  if (entry.size === 0) {
    return Errors.badRequest('File is empty');
  }

  const rawBuf = Buffer.from(await entry.arrayBuffer());
  let processed;
  try {
    processed = await processAvatarImage(rawBuf);
  } catch (err) {
    if (err instanceof AvatarValidationError) {
      return apiError(err.message, statusForAvatarError(err.code), 'UnsupportedMediaType');
    }
    throw err;
  }

  const sha256 = createHash('sha256').update(processed.buffer).digest('hex');
  const fileId = randomUUID();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const objectKey = `uploads/${yyyy}/${mm}/${fileId}.webp`;

  const originalName =
    typeof entry.name === 'string' && entry.name.length > 0
      ? entry.name.slice(0, FILE_ORIGINAL_NAME_MAX_LENGTH)
      : null;

  try {
    await putObject({
      bucket: PUBLIC_BUCKET,
      objectKey,
      body: processed.buffer,
      contentType: processed.mimeType,
    });
  } catch (err) {
    return apiError(
      `Storage upload failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      502,
      'BadGateway',
    );
  }

  const previousLogoId = group.logo_file_id;

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          id: fileId,
          bucket: PUBLIC_BUCKET,
          object_key: objectKey,
          mime_type: processed.mimeType,
          byte_size: processed.buffer.length,
          sha256,
          original_name: originalName,
          uploaded_by: auth.user.sub,
        },
      });

      await tx.group.update({
        where: { id: groupId },
        data: { logo_file_id: file.id, updated_by: auth.user.sub },
      });

      let previous: { bucket: string; object_key: string } | null = null;
      if (previousLogoId) {
        const prev = await tx.file.findUnique({
          where: { id: previousLogoId },
          select: { bucket: true, object_key: true, deleted_at: true },
        });
        if (prev && !prev.deleted_at) {
          await tx.file.update({
            where: { id: previousLogoId },
            data: { deleted_at: new Date(), deleted_by: auth.user.sub },
          });
          previous = { bucket: prev.bucket, object_key: prev.object_key };
        }
      }

      return { file, previous };
    });

    // Best-effort cleanup of the old MinIO object after the DB transaction
    // commits.  A failure here only leaves an orphan blob which a sweep can
    // reconcile via the soft-deleted File row.
    if (txResult.previous) {
      removeObject(txResult.previous.bucket, txResult.previous.object_key).catch(() => {
        /* non-fatal */
      });
    }

    return NextResponse.json(shapeFileSummary(txResult.file), { status: 200 });
  } catch (err) {
    // DB transaction failed — roll back the just-uploaded MinIO object so we
    // don't leave an orphan blob.
    removeObject(PUBLIC_BUCKET, objectKey).catch(() => {
      /* non-fatal */
    });
    throw err;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return Errors.unauthorized(auth.error);
  }

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) {
    return Errors.badRequest('Invalid group id');
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, owner_id: true, deleted_at: true, logo_file_id: true },
  });
  if (!group || group.deleted_at) {
    return Errors.notFound('Group not found');
  }
  if (group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can remove the logo');
  }

  const previousLogoId = group.logo_file_id;
  if (!previousLogoId) {
    return new NextResponse(null, { status: 204 });
  }

  const removed = await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: groupId },
      data: { logo_file_id: null, updated_by: auth.user.sub },
    });

    const prev = await tx.file.findUnique({
      where: { id: previousLogoId },
      select: { bucket: true, object_key: true, deleted_at: true },
    });
    if (!prev || prev.deleted_at) {
      return null;
    }

    await tx.file.update({
      where: { id: previousLogoId },
      data: { deleted_at: new Date(), deleted_by: auth.user.sub },
    });
    return { bucket: prev.bucket, object_key: prev.object_key };
  });

  if (removed) {
    removeObject(removed.bucket, removed.object_key).catch(() => {
      /* non-fatal */
    });
  }

  return new NextResponse(null, { status: 204 });
}
