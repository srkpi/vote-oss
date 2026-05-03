import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { Errors } from '@/lib/errors';
import { shapeFileSummary } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { removeObject } from '@/lib/storage/minio';
import { isValidUuid } from '@/lib/utils/common';

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file metadata (id, public URL, mime type, size)
 *     tags: [Files]
 *     security:
 *       - cookieAuth: []
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid file id');

  const row = await prisma.file.findUnique({ where: { id } });
  if (!row || row.deleted_at) return Errors.notFound('File not found');

  return NextResponse.json(shapeFileSummary(row));
}

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Soft-delete a file and remove the object from MinIO
 *     description: Only the original uploader may delete their file.
 *     tags: [Files]
 *     security:
 *       - cookieAuth: []
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid file id');

  const row = await prisma.file.findUnique({ where: { id } });
  if (!row || row.deleted_at) return Errors.notFound('File not found');
  if (row.uploaded_by !== auth.user.sub) {
    return Errors.forbidden('Only the uploader can delete this file');
  }

  await prisma.file.update({
    where: { id },
    data: { deleted_at: new Date(), deleted_by: auth.user.sub },
  });

  // Remove the object after the DB update succeeds.  If MinIO removal fails
  // we still report success — the row is soft-deleted, the FK on Group
  // cleared via SetNull, and a separate sweep can reconcile orphan objects.
  try {
    await removeObject(row.bucket, row.object_key);
  } catch {
    /* non-fatal */
  }

  return new NextResponse(null, { status: 204 });
}
