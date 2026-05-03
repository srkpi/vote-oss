import type { File as DbFile } from '@prisma/client';

import { APP_URL } from '@/lib/config/client';
import { type AllowedImageMimeType, FILE_ALLOWED_IMAGE_MIME_TYPES } from '@/lib/constants';
import type { FileSummary } from '@/types/file';

export const ALLOWED_IMAGE_MIME_SET: ReadonlySet<string> = new Set(FILE_ALLOWED_IMAGE_MIME_TYPES);

export function isAllowedImageMime(mime: string): mime is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_SET.has(mime);
}

const MIME_EXTENSIONS: Record<AllowedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function extensionFor(mime: AllowedImageMimeType): string {
  return MIME_EXTENSIONS[mime];
}

/**
 * Inspect the first bytes of `buf` and return the MIME type if it matches one
 * of the supported image formats — otherwise `null`.  The header check is the
 * source of truth; the client-supplied Content-Type is only cross-checked
 * against this result.
 */
export function detectImageMime(buf: Buffer): AllowedImageMimeType | null {
  if (buf.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return 'image/png';
    }
  }
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF: "GIF87a" or "GIF89a"
  if (buf.length >= 6) {
    const head = buf.slice(0, 6).toString('ascii');
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (buf.length >= 12) {
    const riff = buf.slice(0, 4).toString('ascii');
    const webp = buf.slice(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  }
  return null;
}

/**
 * Build a same-origin URL pointing at the public file proxy.  In deployment
 * a Caddy reverse-proxy serves `/files/*` straight from the public MinIO
 * bucket, so we never expose raw MinIO URLs to clients or external services
 * — same scheme/host as the Next app keeps CSP and TLS simple.
 */
export function fileProxyUrl(objectKey: string): string {
  const safeKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${APP_URL.replace(/\/+$/, '')}/files/${safeKey}`;
}

export function shapeFileSummary(row: DbFile): FileSummary {
  return {
    id: row.id,
    url: fileProxyUrl(row.object_key),
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    originalName: row.original_name,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at.toISOString(),
  };
}
