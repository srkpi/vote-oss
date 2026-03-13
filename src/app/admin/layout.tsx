import type { Metadata } from 'next';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import type { Admin } from '@/types/admin';

export const metadata: Metadata = {
  title: {
    default: 'Адмін-панель',
    template: '%s | Адмін-панель | КПІ Голос',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  let manageAdmins = false;
  if (session?.isAdmin && session.userId) {
    const { data: admin } = await serverFetch<Admin>(`/api/admins/${session.userId}`);
    manageAdmins = admin?.manage_admins ?? false;
  }

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] flex bg-[var(--surface)]">
      <AdminSidebar manageAdmins={manageAdmins} />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
        <div className="lg:hidden h-[56px] w-full" aria-hidden="true" />
      </div>
    </div>
  );
}
