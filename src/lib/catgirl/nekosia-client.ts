import {
  NEKOSIA_API_BASE_URL,
  NEKOSIA_IMAGE_CATEGORY,
  NEKOSIA_IMAGE_TAG,
  NEKOSIA_MAX_COUNT_PER_REQUEST,
} from '@/lib/constants';
import type { CatgirlImage, NekosiaApiImage, NekosiaApiResponse } from '@/types/catgirl';

function buildRequestUrl(count: number): string {
  const url = new URL(`${NEKOSIA_API_BASE_URL}/images/${NEKOSIA_IMAGE_CATEGORY}`);
  url.searchParams.set('count', String(Math.min(count, NEKOSIA_MAX_COUNT_PER_REQUEST)));
  url.searchParams.set('additionalTags', NEKOSIA_IMAGE_TAG);
  url.searchParams.set('session', 'ip');
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNekosiaApiImage(value: unknown): value is NekosiaApiImage {
  if (!isRecord(value)) return false;
  const image = value.image;
  if (!isRecord(image)) return false;
  const compressed = image.compressed;
  return (
    typeof value.id === 'string' &&
    isRecord(compressed) &&
    typeof compressed.url === 'string' &&
    isRecord(value.metadata) &&
    isRecord((value.metadata as Record<string, unknown>).compressed)
  );
}

function extractApiImages(response: NekosiaApiResponse): NekosiaApiImage[] {
  if (Array.isArray(response.images) && response.images.length > 0) {
    return response.images.filter(isNekosiaApiImage);
  }
  if (isNekosiaApiImage(response)) {
    return [response];
  }
  return [];
}

function toCatgirlImage(raw: NekosiaApiImage): CatgirlImage {
  const compressed = raw.image.compressed;
  const compressedMeta = raw.metadata.compressed;
  const artist = raw.attribution?.artist ?? null;

  return {
    id: raw.id,
    url: compressed.url,
    width: compressedMeta.width,
    height: compressedMeta.height,
    color: raw.colors?.main ?? '#fce7f3',
    artistName: artist?.username ?? null,
    artistProfileUrl: artist?.profile ?? null,
    sourceUrl: raw.source?.url ?? raw.source?.direct ?? null,
  };
}

export async function fetchCatgirlImageBatch(count: number): Promise<CatgirlImage[]> {
  try {
    const res = await fetch(buildRequestUrl(count), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const body = (await res.json()) as NekosiaApiResponse;
    if (!body.success) return [];

    return extractApiImages(body).map(toCatgirlImage);
  } catch {
    return [];
  }
}
