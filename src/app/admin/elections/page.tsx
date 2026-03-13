import { CheckCircle2, ChevronRight, Clock, CreditCard, FileText, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminElectionsClient } from '@/components/admin/admin-elections-client';
import { StatCard } from '@/components/admin/stat-card';
import { Button } from '@/components/ui/button';
import { getCurrentAdmin } from '@/lib/current-admin';
import { serverFetch } from '@/lib/server-auth';
import type { Election } from '@/types/election';

export const metadata: Metadata = {
  title: 'Голосування',
};

export default async function AdminElectionsPage() {
  const [{ data: elections, error }, currentAdmin] = await Promise.all([
    serverFetch<Election[]>('/api/elections'),
    getCurrentAdmin(),
  ]);

  const all = elections ?? [];
  const openCount = all.filter((e) => e.status === 'open').length;
  const upcomingCount = all.filter((e) => e.status === 'upcoming').length;
  const closedCount = all.filter((e) => e.status === 'closed').length;
  const totalBallots = all.reduce((sum, e) => sum + e.ballotCount, 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-2 sm:mb-3">
              <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
                Адмін
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[var(--foreground)]">Голосування</span>
            </nav>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              Голосування
            </h1>
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
              Керування всіма голосуваннями в системі
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0" style={{ animationDelay: '100ms' }}>
            <Button variant="accent" size="sm" asChild>
              <Link href="/admin/elections/new" className="inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Нове голосування</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Активних зараз"
            value={openCount.toLocaleString('uk-UA')}
            accent="success"
            delay={0}
            icon={<CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Завершених"
            value={closedCount.toLocaleString('uk-UA')}
            accent="navy"
            delay={120}
            icon={<FileText className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Очікується"
            value={upcomingCount.toLocaleString('uk-UA')}
            accent="orange"
            delay={60}
            icon={<Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <StatCard
            label="Усього бюлетенів"
            value={totalBallots.toLocaleString('uk-UA')}
            accent="info"
            delay={180}
            icon={<CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />}
          />
        </div>

        <AdminElectionsClient elections={all} error={error} currentAdmin={currentAdmin} />
      </div>
    </div>
  );
}
