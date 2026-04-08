import { CheckCircle2, Clock, CreditCard, FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StatCard } from '@/components/admin/stat-card';
import { PageHeader } from '@/components/common/page-header';
import { AdminElectionsClient } from '@/components/elections/admin/admin-elections-client';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { pluralize } from '@/lib/utils/common';

export const metadata: Metadata = {
  title: 'Голосування',
};

export default async function AdminElectionsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { data: elections, error } = await serverApi.elections.list();

  const all = elections ?? [];
  const { openCount, upcomingCount, closedCount, totalBallots } = all.reduce(
    (acc, e) => {
      if (e.deletedAt) return acc;
      if (e.status === 'open') acc.openCount++;
      else if (e.status === 'upcoming') acc.upcomingCount++;
      else if (e.status === 'closed') acc.closedCount++;
      acc.totalBallots += e.ballotCount ?? 0;
      return acc;
    },
    {
      openCount: 0,
      upcomingCount: 0,
      closedCount: 0,
      totalBallots: 0,
    },
  );

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
            label={pluralize(totalBallots, ['Бюлетень', 'Бюлетені', 'Бюлетенів'], false)}
            value={totalBallots.toLocaleString('uk-UA')}
            accent="info"
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
        </div>

        <AdminElectionsClient elections={all} session={session} error={error} />
      </div>
    </div>
  );
}
