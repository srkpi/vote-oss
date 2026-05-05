import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { APP_NAME } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { PostHogProvider } from '@/providers/posthog-provider';

export const metadata: Metadata = {
  title: {
    default: 'Адмін-панель',
    template: `%s | Адмін | ${APP_NAME}`,
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <PostHogProvider session={session}>
      <div className="bg-surface flex min-h-dvh">
        <AdminSidebar
          manageAdmins={session.manageAdmins}
          manageGroups={session.manageGroups}
          managePetitions={session.managePetitions}
          manageFaq={session.manageFaq}
          restrictedToFaculty={session.restrictedToFaculty}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <div className="h-14 w-full lg:hidden" aria-hidden="true" />
        </div>
      </div>
    </PostHogProvider>
  );
}
