import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { APP_NAME } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: {
    default: 'Адмін-панель',
    template: `%s | Адмін-панель | ${APP_NAME}`,
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))]">
      <AdminSidebar
        manageAdmins={session.manageAdmins}
        restrictedToFaculty={session.restrictedToFaculty}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {children}
        <div className="h-14 w-full lg:hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
