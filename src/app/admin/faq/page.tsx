import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { FaqManager } from '@/components/faq/faq-manager';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'FAQ',
};

export default async function AdminFaqPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/auth/login');
  }

  if (session.restrictedToFaculty) {
    redirect('/admin');
  }

  const { data: categories } = await serverApi.getFaq();

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'FAQ' }]}
        title="FAQ"
        description="Керування сторінкою частих запитань"
      />

      <div className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <FaqManager initialCategories={categories ?? []} />
        </div>
      </div>
    </div>
  );
}
