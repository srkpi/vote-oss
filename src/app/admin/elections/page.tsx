import { CheckCircle2, Clock, CreditCard, FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminElectionsClient } from '@/components/admin/admin-elections-client';
import { StatCard } from '@/components/admin/stat-card';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Голосування',
};

export default async function AdminElectionsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/auth/login');
  }

  const { data: elections, error } = await serverApi.getElections();

  const all = elections ?? [];
  const openCount = all.filter((e) => e.status === 'open').length;
  const upcomingCount = all.filter((e) => e.status === 'upcoming').length;
  const closedCount = all.filter((e) => e.status === 'closed').length;
  const totalBallots = all.reduce((sum, e) => sum + e.ballotCount, 0);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[{ label: 'Адмін', href: '/admin' }, { label: 'Голосування' }]}
        title="Голосування"
        description="Керування всіма голосуваннями в системі"
      >
        <Button variant="accent" size="sm" asChild>
          <Link href="/admin/elections/new" className="inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Нове голосування</span>
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Активних"
            value={openCount.toLocaleString('uk-UA')}
            accent="success"
            icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Завершених"
            value={closedCount.toLocaleString('uk-UA')}
            accent="navy"
            icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Очікується"
            value={upcomingCount.toLocaleString('uk-UA')}
            accent="orange"
            icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="info"
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
        </div>

        <AdminElectionsClient elections={all} error={error} session={session} />
      </div>
    </div>
  );
}
