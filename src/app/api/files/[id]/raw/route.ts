import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

import { Errors } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { getObjectStream } from '@/lib/storage/minio';
import { isValidUuid } from '@/lib/utils/common';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/files/{id}/raw:
 *   get:
 *     summary: Stream the file bytes from object storage
 *     description: >
 *       Public — anyone with the file id (a random UUID) may fetch the
 *       contents.  This proxies bytes from MinIO so consumers (browsers,
 *       external doc generators) only ever see same-origin URLs and don't
 *       need MinIO to terminate TLS or be reachable from the public
 *       internet directly.
 *     tags: [Files]
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidUuid(id)) return Errors.badRequest('Invalid file id');

  const row = await prisma.file.findUnique({
    where: { id },
    select: {
      bucket: true,
      object_key: true,
      mime_type: true,
      byte_size: true,
      deleted_at: true,
    },
  });
  if (!row || row.deleted_at) return Errors.notFound('File not found');

  let nodeStream: Readable;
  try {
    nodeStream = await getObjectStream(row.bucket, row.object_key);
  } catch {
    return Errors.notFound('File not found in storage');
  }

  // Convert Node Readable → Web ReadableStream so NextResponse can stream it.
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': row.mime_type,
      'Content-Length': String(row.byte_size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
