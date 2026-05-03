import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { FILE_MAX_SIZE_BYTES, FILE_ORIGINAL_NAME_MAX_LENGTH } from '@/lib/constants';
import { apiError, Errors } from '@/lib/errors';
import { detectImageMime, extensionFor, shapeFileSummary } from '@/lib/files';
import { prisma } from '@/lib/prisma';
import { PUBLIC_BUCKET, putObject } from '@/lib/storage/minio';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/files:
 *   post:
 *     summary: Upload an image file (multipart/form-data, field name "file")
 *     description: >
 *       Stores the file in the public MinIO bucket and registers a row in the
 *       `files` table.  Whitelisted MIME types only (PNG, JPEG, WebP, GIF —
 *       SVG is intentionally rejected).  The Content-Type header is treated
 *       as a hint; the actual MIME is determined from the file's magic bytes.
 *     tags: [Files]
 *     security:
 *       - cookieAuth: []
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return Errors.unauthorized(auth.error);

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

  // The browser-provided Content-Type is only a hint, but if it disagrees with
  // the magic-bytes detection we treat that as a misuse worth rejecting.
  if (entry.type && entry.type !== detectedMime) {
    return apiError(
      `Declared content-type "${entry.type}" does not match detected "${detectedMime}"`,
      415,
      'UnsupportedMediaType',
    );
  }

  const sha256 = createHash('sha256').update(buf).digest('hex');
  const id = randomUUID();
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const objectKey = `uploads/${yyyy}/${mm}/${id}.${extensionFor(detectedMime)}`;

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

  const row = await prisma.file.create({
    data: {
      id,
      bucket: PUBLIC_BUCKET,
      object_key: objectKey,
      mime_type: detectedMime,
      byte_size: buf.length,
      sha256,
      original_name: originalName,
      uploaded_by: auth.user.sub,
    },
  });

  return NextResponse.json(shapeFileSummary(row), { status: 201 });
}
