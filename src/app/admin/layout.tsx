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
    <div className="min-h-[calc(100dvh-var(--header-height))] flex bg-[var(--surface)]">
      <AdminSidebar manageAdmins={session.manageAdmins} />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
        <div className="lg:hidden h-[56px] w-full" aria-hidden="true" />
      </div>
    </div>
  );
}
