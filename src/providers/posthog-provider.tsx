'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { Suspense, useEffect, useMemo } from 'react';

import { PostHogPageView } from '@/components/common/posthog-page-view';
import type { User } from '@/types/auth';

interface Props {
  children: React.ReactNode;
  session: User | null;
}

export function PostHogProvider({ children, session }: Props) {
  useMemo(() => {
    if (session?.userId) {
      posthog.identify(session.userId, {
        isAdmin: session.isAdmin,
        fullName: session.fullName,
        faculty: session.faculty,
        group: session.group,
        speciality: session.speciality,
        studyYear: session.studyYear,
        studyForm: session.studyForm,
      });
    }
  }, [session]);

  useEffect(() => {
    if (!session?.userId) {
      posthog.reset();
    }
  }, [session?.userId]);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
