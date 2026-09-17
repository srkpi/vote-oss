import {
  CATGIRL_IMAGE_POOL_MAX_FETCH_ATTEMPTS,
  CATGIRL_IMAGE_POOL_REFILL_THRESHOLD,
  CATGIRL_IMAGE_POOL_TARGET_SIZE,
  LOCAL_STORAGE_CATGIRL_IMAGES_KEY,
  NEKOSIA_MAX_COUNT_PER_REQUEST,
} from '@/lib/constants';
import type { CatgirlImage } from '@/types/catgirl';

import { fetchCatgirlImageBatch } from './nekosia-client';

let pool: CatgirlImage[] = [];
let storageLoaded = false;
let refillInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeCatgirlImagePool(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isCatgirlImage(value: unknown): value is CatgirlImage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.url === 'string' && typeof v.color === 'string';
}

function loadFromStorage(): CatgirlImage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CATGIRL_IMAGES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCatgirlImage);
  } catch {
    return [];
  }
}

function persistToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CATGIRL_IMAGES_KEY, JSON.stringify(pool));
  } catch {}
}

async function refillPool(): Promise<void> {
  if (refillInFlight) return refillInFlight;

  refillInFlight = (async () => {
    let attempts = 0;
    const seen = new Set(pool.map((img) => img.id));

    while (
      pool.length < CATGIRL_IMAGE_POOL_TARGET_SIZE &&
      attempts < CATGIRL_IMAGE_POOL_MAX_FETCH_ATTEMPTS
    ) {
      attempts += 1;
      const remaining = CATGIRL_IMAGE_POOL_TARGET_SIZE - pool.length;
      const batch = await fetchCatgirlImageBatch(
        Math.min(remaining, NEKOSIA_MAX_COUNT_PER_REQUEST),
      );

      if (batch.length === 0) break;

      let addedAny = false;
      for (const image of batch) {
        if (seen.has(image.id)) continue;
        seen.add(image.id);
        pool.push(image);
        addedAny = true;
      }
      persistToStorage();
      notify();
      if (!addedAny) break;
    }
  })().finally(() => {
    refillInFlight = null;
  });

  return refillInFlight;
}

export function ensureCatgirlImagePoolReady(): void {
  if (!storageLoaded) {
    storageLoaded = true;
    pool = loadFromStorage();
    if (pool.length > 0) notify();
  }
  if (pool.length <= CATGIRL_IMAGE_POOL_REFILL_THRESHOLD) {
    void refillPool();
  }
}

export function getCatgirlImagePoolSize(): number {
  return pool.length;
}

export function claimNextCatgirlImage(): CatgirlImage | null {
  const next = pool.shift() ?? null;
  if (next) {
    persistToStorage();
    if (pool.length <= CATGIRL_IMAGE_POOL_REFILL_THRESHOLD) {
      void refillPool();
    }
  } else {
    void refillPool();
  }
  return next;
}
