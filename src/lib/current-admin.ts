import { cache } from 'react';

import { getServerSession, serverFetch } from '@/lib/server-auth';
import type { Admin } from '@/types/admin';

/**
 * Returns the current user's Admin record, or null if not found.
 *
 * Wrapped in React `cache()` so it is deduplicated within a single
 * server-render pass — layout + page components share one result with
 * zero extra HTTP calls.
 */
export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  const session = await getServerSession();
  if (!session?.userId) return null;
  const { data } = await serverFetch<Admin>(`/api/admins/${session.userId}`);
  return data;
});
