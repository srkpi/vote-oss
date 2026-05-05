import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { FILE_MAX_SIZE_BYTES, FILE_ORIGINAL_NAME_MAX_LENGTH } from '@/lib/constants';
import { apiError, Errors } from '@/lib/errors';
import { detectImageMime, extensionFor, shapeFileSummary } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { PUBLIC_BUCKET, putObject, removeObject } from '@/lib/storage/minio';
import { isValidUuid } from '@/lib/utils/common';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/groups/{id}/avatar:
 *   put:
 *     summary: Set the group logo (multipart/form-data, field name "file")
 *     description: >
 *       Atomically uploads the new logo, links it to the group and removes the
 *       previous logo (DB row + MinIO object).  Whitelisted MIME types only
 *       (PNG, JPEG, WebP, GIF — SVG is intentionally rejected).  Only the
 *       group owner may call this endpoint.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, owner_id: true, deleted_at: true, logo_file_id: true },
  });
  if (!group || group.deleted_at) return Errors.notFound('Group not found');
  if (group.owner_id !== auth.user.sub) {
    return Errors.forbidden('Only the group owner can change the logo');
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
  if (entry.size > FILE_MAX_SIZE_BYTES) {
    return apiError(
      `File exceeds the ${Math.floor(FILE_MAX_SIZE_BYTES / (1024 * 1024))} MiB limit`,
      413,
      'PayloadTooLarge',
    );
  }

  const buf = Buffer.from(await entry.arrayBuffer());
  const detectedMime = detectImageMime(buf);
  if (!detectedMime) {
    return apiError(
      'Unsupported file type — only PNG, JPEG, WebP, and GIF images are allowed',
      415,
      'UnsupportedMediaType',
    );
  }

  if (entry.type && entry.type !== detectedMime) {
    return apiError(
      `Declared content-type "${entry.type}" does not match detected "${detectedMime}"`,
      415,
      'UnsupportedMediaType',
    );
  }

  const sha256 = createHash('sha256').update(buf).digest('hex');
  const fileId = randomUUID();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const objectKey = `uploads/${yyyy}/${mm}/${fileId}.${extensionFor(detectedMime)}`;

  const originalName =
    typeof entry.name === 'string' && entry.name.length > 0
      ? entry.name.slice(0, FILE_ORIGINAL_NAME_MAX_LENGTH)
      : null;

  try {
    await putObject({
      bucket: PUBLIC_BUCKET,
      objectKey,
      body: buf,
      contentType: detectedMime,
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
          mime_type: detectedMime,
          byte_size: buf.length,
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

/**
 * @swagger
 * /api/groups/{id}/avatar:
 *   delete:
 *     summary: Remove the group logo
 *     description: Only the group owner may call this endpoint.
 *     tags: [Groups]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id: groupId } = await params;
  if (!isValidUuid(groupId)) return Errors.badRequest('Invalid group id');

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, owner_id: true, deleted_at: true, logo_file_id: true },
  });
  if (!group || group.deleted_at) return Errors.notFound('Group not found');
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
    if (!prev || prev.deleted_at) return null;

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
