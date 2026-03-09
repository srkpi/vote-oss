import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/server-auth';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export const metadata: Metadata = {
  title: {
    default: 'Адмін-панель',
    template: '%s | Адмін-панель | КПІ Голос',
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) redirect('/auth/login');
  if (!session.isAdmin) redirect('/elections');

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] flex bg-[var(--surface)]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
        <div className="lg:hidden h-[56px] w-full" aria-hidden="true" />
      </div>
    </div>
  );
}
