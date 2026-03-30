'use client';

import { useEffect } from 'react';

import { syncSessionUser } from '@/lib/vote-storage';

interface SessionGuardProps {
  userId: string;
}

/**
 * Invisible client component that must be rendered on every authenticated
 * page/layout.
 *
 * On mount it compares the current session's userId against the one stored in
 * localStorage from the previous visit. If they differ (new user, re-login
 * after token expiry, etc.) all locally cached vote records
 * are cleared before the new userId is persisted.
 *
 * This is a zero-render component — it returns null and has no visible output.
 */
export function SessionGuard({ userId }: SessionGuardProps) {
  useEffect(() => {
    syncSessionUser(userId);
  }, [userId]);

  return null;
}
