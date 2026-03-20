import { CheckCircle2, CreditCard, FileText, Plus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StatCard } from '@/components/admin/stat-card';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Адмін панель',
};

const statusConfig = {
  open: {
    label: 'Активне',
    dot: 'bg-(--success)',
    text: 'text-(--success)',
    bg: 'bg-(--success-bg)',
  },
  upcoming: {
    label: 'Очікується',
    dot: 'bg-(--kpi-orange)',
    text: 'text-(--kpi-orange)',
    bg: 'bg-(--warning-bg)',
  },
  closed: {
    label: 'Завершено',
    dot: 'bg-(--kpi-gray-light)',
    text: 'text-(--muted-foreground)',
    bg: 'bg-(--surface)',
  },
};

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/auth/login');
  }

  const [electionsResult, adminsResult] = await Promise.all([
    serverApi.getElections(),
    serverApi.getAdmins(),
  ]);

  const elections = electionsResult.data ?? [];
  const admins = adminsResult.data ?? [];

  const openElections = elections.filter((e) => e.status === 'open');
  const totalBallots = elections.reduce((sum, e) => sum + e.ballotCount, 0);

  const recentElections = [...elections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title={`Добрий день, ${session?.fullName.split(' ')[1] ?? session?.fullName}!`}
        description="Ось короткий огляд системи голосування"
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
            value={openElections.length.toLocaleString('uk-UA')}
            accent="success"
            icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Голосувань"
            value={elections.length.toLocaleString('uk-UA')}
            accent="navy"
            icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="orange"
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
          <StatCard
            label="Адміністраторів"
            value={admins.length.toLocaleString('uk-UA')}
            accent="info"
            icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="overflow-hidden rounded-xl border border-(--border-color) bg-white shadow-(--shadow-card)">
            <h2 className="font-display border-b border-(--border-subtle) px-4 py-4 text-base font-semibold text-(--foreground) sm:px-6 sm:text-lg">
              Нещодавні голосування
            </h2>

            {recentElections.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-(--border-subtle) bg-(--surface)">
                  <FileText className="h-7 w-7 text-(--kpi-gray-mid)" strokeWidth={1.5} />
                </div>
                <p className="font-display text-base font-semibold text-(--foreground)">
                  Голосувань поки немає
                </p>
                <p className="font-body mt-1 mb-4 text-sm text-(--muted-foreground)">
                  Створіть перше голосування для вашого підрозділу
                </p>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/admin/elections/new">Створити голосування</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-(--border-subtle)">
                {recentElections.map((election) => {
                  const status = statusConfig[election.status];
                  return (
                    <Link
                      key={election.id}
                      href={`/admin/elections/${election.id}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--surface) sm:gap-4 sm:px-6 sm:py-4"
                    >
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${status.dot} ${election.status === 'open' ? 'animate-pulse' : ''}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-body truncate text-sm font-medium text-(--foreground) transition-colors group-hover:text-(--kpi-navy)">
                          {election.title}
                        </p>
                        <p className="font-body mt-0.5 hidden text-xs text-(--muted-foreground) sm:block">
                          {formatDateTime(election.opensAt)} — {formatDateTime(election.closesAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                        <span className="font-body hidden text-xs text-(--muted-foreground) sm:inline">
                          {election.ballotCount} голосів
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
