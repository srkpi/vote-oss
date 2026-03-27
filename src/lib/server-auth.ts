'use server';

import { headers } from 'next/headers';

import type { User } from '@/types/auth';

function decodeHeader(headerValue: string | null): string {
  if (!headerValue) return '';
  try {
    return Buffer.from(headerValue, 'base64').toString('utf8');
  } catch {
    return headerValue;
  }
}

export async function getServerSession(): Promise<User | null> {
  const h = await headers();
  const userId = h.get('x-user-id');
  if (!userId) return null;

  const isAdmin = h.get('x-user-is-admin') === 'true';
  const studyYearRaw = h.get('x-user-study-year');

  return {
    userId,
    fullName: decodeHeader(h.get('x-user-name')),
    faculty: decodeHeader(h.get('x-user-faculty')),
    group: decodeHeader(h.get('x-user-group')),
    speciality: decodeHeader(h.get('x-user-speciality')) || undefined,
    studyYear: studyYearRaw ? Number(studyYearRaw) : undefined,
    studyForm: decodeHeader(h.get('x-user-study-form')) || undefined,
    isAdmin,
    restrictedToFaculty: !isAdmin || h.get('x-user-restricted-to-faculty') === 'true',
    manageAdmins: isAdmin && h.get('x-user-manage-admins') === 'true',
  };
}
