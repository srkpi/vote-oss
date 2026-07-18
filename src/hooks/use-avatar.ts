'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  ensureAvatars,
  getCachedAvatar,
  primeSelfAvatarFromStorage,
  subscribeAvatars,
} from '@/lib/avatar-store';

/**
 * Reads (and subscribes to) a single user's cached avatar URL.
 *
 * `fallback` is used only until the shared cache has an entry for this id —
 * pass a value you already know (a server-rendered `avatarUrl`, or a
 * decrypted ballot's voter) so there's no flash of "no avatar" on first
 * paint while the cache catches up.
 */
export function useAvatar(
  userId: string | null | undefined,
  fallback: string | null = null,
): string | null {
  const key = userId ?? '';
  const getSnapshot = useCallback(() => getCachedAvatar(key), [key]);
  const value = useSyncExternalStore(subscribeAvatars, getSnapshot, getSnapshot);
  if (!userId) return null;
  return value !== undefined ? value : fallback;
}

/** Hydrates + refreshes the signed-in user's own avatar (header, join page, ...). */
export function useSelfAvatarSync(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;
    primeSelfAvatarFromStorage(userId);
    void ensureAvatars([userId]);
  }, [userId]);
}
