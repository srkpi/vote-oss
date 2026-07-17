/**
 * Hardened avatar image pipeline.
 *
 * The uploaded bytes are NEVER stored or served as-is. Every avatar is:
 *   1. Identified by magic bytes (not filename / declared Content-Type).
 *   2. Decoded by libvips (via sharp) under a strict pixel-count ceiling.
 *   3. Re-encoded from scratch to a fixed-size WebP.
 *
 * Step 3 is what actually makes this safe: whatever bytes come out the other
 * end are pixels sharp itself produced, so there's nowhere for a polyglot
 * payload, an embedded script, or stale metadata (EXIF GPS tags, camera
 * serials, ICC profiles, …) to survive into the stored file. This is
 * meaningfully stronger than signature-sniffing alone, which only proves the
 * *first few bytes* look like an image container and says nothing about
 * anything appended after a valid PNG IEND chunk, for example.
 */

import sharp from 'sharp';

import {
  AVATAR_ALLOWED_IMAGE_MIME_TYPES,
  AVATAR_MAX_INPUT_PIXELS,
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_OUTPUT_QUALITY_STEPS,
  AVATAR_OUTPUT_SIZE_PX,
} from '@/lib/constants';
import { detectImageMime } from '@/lib/files';

export type AvatarValidationCode =
  'unsupported_format' | 'invalid_image' | 'image_too_large' | 'image_too_complex';

export class AvatarValidationError extends Error {
  constructor(
    public readonly code: AvatarValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'AvatarValidationError';
  }
}

export interface ProcessedAvatar {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
}

const ALLOWED = new Set<string>(AVATAR_ALLOWED_IMAGE_MIME_TYPES);

/**
 * Validate + re-encode an uploaded avatar. Throws `AvatarValidationError`
 * (its `message` is safe to return to the caller) for anything that doesn't
 * pass. Never throws a raw sharp/libvips error to the caller.
 */
export async function processAvatarImage(input: Buffer): Promise<ProcessedAvatar> {
  const detected = detectImageMime(input);
  if (!detected || !ALLOWED.has(detected)) {
    throw new AvatarValidationError(
      'unsupported_format',
      'Unsupported file type — only PNG, JPEG, and WebP images are allowed for avatars',
    );
  }

  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(input, {
      failOn: 'error',
      limitInputPixels: AVATAR_MAX_INPUT_PIXELS,
    }).metadata();
    width = metadata.width;
    height = metadata.height;
  } catch {
    throw new AvatarValidationError('invalid_image', 'The file is not a valid image');
  }

  if (!width || !height) {
    throw new AvatarValidationError('invalid_image', 'The file is not a valid image');
  }
  if (width * height > AVATAR_MAX_INPUT_PIXELS) {
    throw new AvatarValidationError('image_too_large', 'Image dimensions are too large');
  }

  // Re-decode from the ORIGINAL buffer on every quality attempt (never
  // re-encode a previous attempt's output) so quality loss doesn't compound.
  let output: Buffer | null = null;
  for (const quality of AVATAR_OUTPUT_QUALITY_STEPS) {
    const candidate = await sharp(input, {
      failOn: 'error',
      limitInputPixels: AVATAR_MAX_INPUT_PIXELS,
    })
      .rotate() // apply EXIF orientation before we strip EXIF below
      .resize(AVATAR_OUTPUT_SIZE_PX, AVATAR_OUTPUT_SIZE_PX, {
        fit: 'cover',
        position: 'attention',
      })
      .webp({ quality })
      // No .withMetadata() call: sharp drops EXIF/ICC/XMP by default, which
      // is exactly what we want for a minimal, stripped avatar file.
      .toBuffer();

    if (candidate.length <= AVATAR_MAX_SIZE_BYTES) {
      output = candidate;
      break;
    }
  }

  if (!output) {
    throw new AvatarValidationError(
      'image_too_complex',
      `Even after compression this image exceeds the ${Math.floor(AVATAR_MAX_SIZE_BYTES / 1024)} KiB limit — try a simpler photo`,
    );
  }

  return {
    buffer: output,
    mimeType: 'image/webp',
    width: AVATAR_OUTPUT_SIZE_PX,
    height: AVATAR_OUTPUT_SIZE_PX,
  };
}

/** Maps a validation failure to the HTTP status the route should return. */
export function statusForAvatarError(code: AvatarValidationCode): number {
  switch (code) {
    case 'unsupported_format':
    case 'invalid_image':
      return 415;
    case 'image_too_large':
    case 'image_too_complex':
      return 413;
  }
}
