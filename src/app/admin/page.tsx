import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  FileText,
  Megaphone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminGreeting } from '@/components/admin/admin-greeting';
import { StatCard } from '@/components/admin/stat-card';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { serverApi } from '@/lib/api/server';
import { PETITION_QUORUM } from '@/lib/constants';
import { getServerSession } from '@/lib/server-auth';
import { cn, pluralize } from '@/lib/utils/common';

export const metadata: Metadata = {
  title: 'Адмін панель',
};

export default async function AdminDashboardPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const [electionsAndPetitions, statsResult] = await Promise.all([
    serverApi.elections.list({ type: 'ALL' }),
    serverApi.stats.getAdmin(),
  ]);

  const stats = statsResult.data;
  const recentElections = (electionsAndPetitions.data?.elections ?? [])
    .filter((e) => !e.deletedAt && e.type === 'ELECTION')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
  const recentPetitions = (electionsAndPetitions.data?.elections ?? [])
    .filter((p) => !p.deletedAt && p.type === 'PETITION')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-border-subtle flex items-center gap-4 border-b bg-white px-4 py-4 sm:px-8 sm:py-6">
        <Link
          href="/"
          className={cn(
            'border-border-subtle hover:bg-surface text-muted-foreground hover:text-foreground',
            'mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            'border transition-all duration-200 lg:hidden',
          )}
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <AdminGreeting name={session?.fullName.split(' ')[1] ?? session?.fullName} />
      </div>

      <div className="space-y-6 p-4 sm:p-8">
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-6">
            <StatCard
              label="Активних"
              value={stats.openElections.toLocaleString('uk-UA')}
              accent="success"
              icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
            />

            <StatCard
              label={pluralize(
                stats.elections,
                ['Голосування', 'Голосування', 'Голосувань'],
                false,
              )}
              value={stats.elections.toLocaleString('uk-UA')}
              accent="navy"
              icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
            />

            <StatCard
              label={pluralize(stats.petitions, ['Петиція', 'Петиції', 'Петицій'], false)}
              value={stats.petitions.toLocaleString('uk-UA')}
              accent="info"
              icon={<Megaphone className="h-4 w-4 sm:h-5 sm:w-5" />}
            />

            <StatCard
              label={pluralize(stats.ballots, ['Бюлетень', 'Бюлетені', 'Бюлетенів'], false)}
              value={stats.ballots.toLocaleString('uk-UA')}
              accent="orange"
              icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
            />

            <StatCard
              label={pluralize(
                stats.admins,
                ['Адміністратор', 'Адміністратори', 'Адміністраторів'],
                false,
              )}
              value={stats.admins.toLocaleString('uk-UA')}
              accent="purple"
              icon={<ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
            />

            <StatCard
              label={pluralize(stats.groups, ['Група', 'Групи', 'Груп'], false)}
              value={stats.groups.toLocaleString('uk-UA')}
              accent="teal"
              icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
            <h2 className="font-display border-border-subtle text-foreground border-b px-4 py-4 text-base font-semibold sm:px-6 sm:text-lg">
              Нещодавні голосування
            </h2>

            {recentElections.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="border-border-subtle bg-surface mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
                  <FileText className="text-kpi-gray-mid h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="font-display text-foreground text-base font-semibold">
                  Голосувань поки немає
                </p>
                <p className="font-body text-muted-foreground mt-1 mb-4 text-sm">
                  Створіть перше голосування для вашого підрозділу
                </p>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/admin/elections/new">Створити голосування</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-border-subtle divide-y">
                {recentElections.map((election) => {
                  return (
                    <Link
                      key={election.id}
                      href={`/admin/elections/${election.id}`}
                      className="group hover:bg-surface flex items-center gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-6 sm:py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-foreground group-hover:text-kpi-navy truncate text-sm font-medium transition-colors">
                          {election.title}
                        </p>
                        <p className="font-body text-muted-foreground mt-0.5 hidden text-xs sm:block">
                          <LocalDateTime date={election.opensAt} /> —{' '}
                          <LocalDateTime date={election.closesAt} />
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <StatusBadge status={election.status} size="sm" />
                        <span className="font-body text-muted-foreground hidden text-xs sm:inline">
                          {election.ballotCount} голосів
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
            <h2 className="font-display border-border-subtle text-foreground border-b px-4 py-4 text-base font-semibold sm:px-6 sm:text-lg">
              Нещодавні петиції
            </h2>

            {recentPetitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="border-border-subtle bg-surface mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border">
                  <Megaphone className="text-kpi-gray-mid h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="font-display text-foreground text-base font-semibold">
                  Петицій поки немає
                </p>
                <p className="font-body text-muted-foreground mt-1 mb-4 text-sm">
                  Створіть першу петицію або дочекайтесь користувацьких ініціатив
                </p>
                <Button variant="accent" size="sm" asChild>
                  <Link href="/petitions/new">Створити петицію</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-border-subtle divide-y">
                {recentPetitions.map((petition) => {
                  const quorum = petition.winningConditions.quorum ?? PETITION_QUORUM;
                  const pct = Math.min(100, Math.round((petition.ballotCount / quorum) * 100));
                  return (
                    <Link
                      key={petition.id}
                      href={`/petitions/${petition.id}`}
                      className="group hover:bg-surface flex items-center gap-3 px-4 py-3 transition-colors sm:gap-4 sm:px-6 sm:py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-foreground group-hover:text-kpi-navy truncate text-sm font-medium transition-colors">
                          {petition.title}
                        </p>
                        <p className="font-body text-muted-foreground mt-0.5 truncate text-xs">
                          {petition.createdBy.fullName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        {!petition.approved ? (
                          <StatusBadge status="pending" size="sm" />
                        ) : (
                          <StatusBadge status={petition.status} size="sm" />
                        )}
                        <span className="font-body text-muted-foreground hidden text-xs sm:inline">
                          {petition.ballotCount}/{quorum} ({pct}%)
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
