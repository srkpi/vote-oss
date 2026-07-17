import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAdmin, requireAuth } from '@/lib/auth';
import {
  AvatarValidationError,
  processAvatarImage,
  statusForAvatarError,
} from '@/lib/avatar-image';
import { clearCachedAvatarUrl, setCachedAvatarUrl } from '@/lib/avatars';
import { AVATAR_MAX_SIZE_BYTES } from '@/lib/constants';
import { apiError, Errors } from '@/lib/errors';
import { shapeFileSummary } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { rateLimitAvatarUpload } from '@/lib/rate-limit';
import { PUBLIC_BUCKET, putObject, removeObject } from '@/lib/storage/minio';

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   put:
 *     summary: Upload or replace the caller's own avatar
 *     description: >
 *       Self-serve only — the path id must match the authenticated user.
 *       Accepts `multipart/form-data` with a single `file` field (PNG, JPEG,
 *       or WebP, max 256 KiB). The image is decoded and re-encoded from
 *       scratch to a 512×512 WebP; EXIF/ICC metadata is always stripped.
 *       Rate-limited per user.
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 *       400:
 *         description: Missing/empty file field
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller may only upload their own avatar
 *       413:
 *         description: File too large, or too large even after compression
 *       415:
 *         description: Unsupported or invalid image
 *       429:
 *         description: Too many uploads — try again later
 *       502:
 *         description: Object storage upload failed
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: targetUserId } = await params;
  if (targetUserId !== auth.user.sub) {
    return Errors.forbidden('You can only upload your own avatar');
  }

  const limit = await rateLimitAvatarUpload(auth.user.sub);
  if (limit.limited) {
    return NextResponse.json(
      {
        error: 'TooManyRequests',
        message: 'Too many avatar uploads, try again shortly',
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
  if (entry.size === 0) return Errors.badRequest('File is empty');
  if (entry.size > AVATAR_MAX_SIZE_BYTES) {
    return apiError(
      `File exceeds the ${Math.floor(AVATAR_MAX_SIZE_BYTES / 1024)} KiB limit`,
      413,
      'PayloadTooLarge',
    );
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
  const objectKey = `avatars/${yyyy}/${mm}/${fileId}.webp`;

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

  const existingProfile = await prisma.userProfile.findUnique({
    where: { id: targetUserId },
    select: { avatar_file_id: true },
  });
  const previousAvatarId = existingProfile?.avatar_file_id ?? null;

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
          original_name: null, // avatars are re-encoded; the original filename carries no useful info
          uploaded_by: auth.user.sub,
        },
      });

      await tx.userProfile.upsert({
        where: { id: targetUserId },
        create: { id: targetUserId, avatar_file_id: file.id },
        update: { avatar_file_id: file.id },
      });

      let previous: { bucket: string; object_key: string } | null = null;
      if (previousAvatarId) {
        const prev = await tx.file.findUnique({
          where: { id: previousAvatarId },
          select: { bucket: true, object_key: true, deleted_at: true },
        });
        if (prev && !prev.deleted_at) {
          await tx.file.update({
            where: { id: previousAvatarId },
            data: { deleted_at: new Date(), deleted_by: auth.user.sub },
          });
          previous = { bucket: prev.bucket, object_key: prev.object_key };
        }
      }

      return { file, previous };
    });

    if (txResult.previous) {
      removeObject(txResult.previous.bucket, txResult.previous.object_key).catch(() => {});
    }

    const summary = shapeFileSummary(txResult.file);
    await setCachedAvatarUrl(targetUserId, summary.url);

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    removeObject(PUBLIC_BUCKET, objectKey).catch(() => {});
    throw err;
  }
}

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   delete:
 *     summary: Remove a user's avatar
 *     description: >
 *       Removable by the user themselves, or by any admin. A no-op (204) if
 *       no avatar is currently set.
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Avatar removed (or none was set)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Caller is neither the user nor an admin
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: targetUserId } = await params;

  const isSelf = targetUserId === auth.user.sub;
  if (!isSelf) {
    const adminAuth = await requireAdmin(req);
    if (!adminAuth.ok) {
      return adminAuth.status === 401
        ? Errors.unauthorized(adminAuth.error)
        : Errors.forbidden('Only the user themselves or an admin can remove this avatar');
    }
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: targetUserId },
    select: { avatar_file_id: true },
  });
  const previousAvatarId = profile?.avatar_file_id ?? null;
  if (!previousAvatarId) {
    return new NextResponse(null, { status: 204 });
  }

  const removed = await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({
      where: { id: targetUserId },
      data: { avatar_file_id: null },
    });

    const prev = await tx.file.findUnique({
      where: { id: previousAvatarId },
      select: { bucket: true, object_key: true, deleted_at: true },
    });
    if (!prev || prev.deleted_at) return null;

    await tx.file.update({
      where: { id: previousAvatarId },
      data: { deleted_at: new Date(), deleted_by: auth.user.sub },
    });
    return { bucket: prev.bucket, object_key: prev.object_key };
  });

  if (removed) {
    removeObject(removed.bucket, removed.object_key).catch(() => {});
  }
  await clearCachedAvatarUrl(targetUserId);

  return new NextResponse(null, { status: 204 });
}
