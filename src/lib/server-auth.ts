'use server';

import { headers } from 'next/headers';

import type { User } from '@/types/auth';

export async function getServerSession(): Promise<User | null> {
  const h = await headers();
  const userId = h.get('x-user-id');
  if (!userId) return null;

  const isAdmin = h.get('x-user-is-admin') === 'true';

  return {
    userId,
    fullName: h.get('x-user-name') ?? '',
    faculty: h.get('x-user-faculty') ?? '',
    group: h.get('x-user-group') ?? '',
    isAdmin,
    restrictedToFaculty: !isAdmin || h.get('x-user-restricted-to-faculty') === 'true',
    manageAdmins: isAdmin && h.get('x-user-manage-admins') === 'true',
  };
}
