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
    dot: 'bg-[var(--success)]',
    text: 'text-[var(--success)]',
    bg: 'bg-[var(--success-bg)]',
  },
  upcoming: {
    label: 'Очікується',
    dot: 'bg-[var(--kpi-orange)]',
    text: 'text-[var(--kpi-orange)]',
    bg: 'bg-[var(--warning-bg)]',
  },
  closed: {
    label: 'Завершено',
    dot: 'bg-[var(--kpi-gray-light)]',
    text: 'text-[var(--muted-foreground)]',
    bg: 'bg-[var(--surface)]',
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
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Нове голосування</span>
          </Link>
        </Button>
      </PageHeader>

      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Активних"
            value={openElections.length.toLocaleString('uk-UA')}
            accent="success"
            icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Голосувань"
            value={elections.length.toLocaleString('uk-UA')}
            accent="navy"
            icon={<FileText className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="orange"
            icon={<CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Адміністраторів"
            value={admins.length.toLocaleString('uk-UA')}
            accent="info"
            icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
            <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)] px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
              Нещодавні голосування
            </h2>

            {recentElections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-[var(--kpi-gray-mid)]" strokeWidth={1.5} />
                </div>
                <p className="font-display text-base font-semibold text-[var(--foreground)]">
                  Голосувань поки немає
                </p>
                <p className="text-sm text-[var(--muted-foreground)] font-body mt-1 mb-4">
                  Створіть перше голосування для вашого підрозділу
                </p>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/admin/elections/new">Створити голосування</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentElections.map((election) => {
                  const status = statusConfig[election.status];
                  return (
                    <Link
                      key={election.id}
                      href={`/admin/elections/${election.id}`}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-[var(--surface)] transition-colors group"
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${status.dot} ${election.status === 'open' ? 'animate-pulse' : ''}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-body text-[var(--foreground)] truncate group-hover:text-[var(--kpi-navy)] transition-colors">
                          {election.title}
                        </p>
                        <p className="text-xs font-body text-[var(--muted-foreground)] mt-0.5 hidden sm:block">
                          {formatDateTime(election.opensAt)} — {formatDateTime(election.closesAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                        <span className="text-xs font-body text-[var(--muted-foreground)] hidden sm:inline">
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
