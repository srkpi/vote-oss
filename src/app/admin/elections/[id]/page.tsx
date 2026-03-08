import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { serverFetch } from '@/lib/server-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { ResultsChart } from '@/components/elections/result-chart';
import { Alert } from '@/components/ui/alert';
import { CopyButton } from '@/components/ui/copy-button';
import { formatDateTime, formatDate } from '@/lib/utils';
import type { ElectionDetail, TallyResponse } from '@/types';

interface AdminElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverFetch<ElectionDetail>(`/api/elections/${id}`);
  return { title: data?.title ? `${data.title} — Деталі` : 'Деталі голосування' };
}

export default async function AdminElectionDetailPage({ params }: AdminElectionPageProps) {
  const { id } = await params;

  const { data: election, status } = await serverFetch<ElectionDetail>(`/api/elections/${id}`);
  if (status === 404 || !election) notFound();

  const isClosed = election.status === 'closed';
  const isOpen = election.status === 'open';

  let tally: TallyResponse | null = null;
  if (isClosed) {
    const { data } = await serverFetch<TallyResponse>(`/api/elections/${id}/tally`);
    tally = data;
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)] px-8 py-6">
        <div className="animate-fade-down">
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-4">
            <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
              Адмін
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link
              href="/admin/elections"
              className="hover:text-[var(--kpi-navy)] transition-colors"
            >
              Голосування
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--foreground)] truncate max-w-xs">{election.title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ElectionStatusBadge status={election.status} size="md" />
                {election.restrictedToFaculty && (
                  <Badge variant="info" size="md">
                    {election.restrictedToFaculty}
                  </Badge>
                )}
                {election.restrictedToGroup && (
                  <Badge variant="secondary" size="md">
                    {election.restrictedToGroup}
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-3xl font-bold text-[var(--foreground)] leading-tight">
                {election.title}
              </h1>
              <p className="text-sm font-body text-[var(--muted-foreground)]">
                Створено: {election.creator.full_name} ({election.creator.faculty}) ·{' '}
                {formatDate(election.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/elections/${id}/ballots`}>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Бюлетені
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/elections/${id}`}>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Публічна сторінка
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Live indicator for open elections */}
            {isOpen && (
              <div
                className="flex items-center gap-4 p-5 rounded-[var(--radius-xl)] bg-[var(--success-bg)] border border-[var(--success)]/20 animate-fade-up"
                style={{ animationFillMode: 'both' }}
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--success)] flex items-center justify-center shrink-0">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-display text-base font-semibold text-[var(--success)]">
                    Голосування активне
                  </p>
                  <p className="text-sm font-body text-[var(--success)]/80 mt-0.5">
                    Завершується {formatDateTime(election.closesAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-3xl font-bold text-[var(--success)]">
                    {election.ballotCount.toLocaleString('uk-UA')}
                  </p>
                  <p className="text-xs font-body text-[var(--success)]/70">бюлетенів подано</p>
                </div>
              </div>
            )}

            {/* Results section (closed only) */}
            {isClosed && tally && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
                style={{ animationDelay: '50ms', animationFillMode: 'both' }}
              >
                <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                    Результати голосування
                  </h2>
                  <Badge variant="secondary" size="md">
                    {tally.totalBallots} бюлетенів
                  </Badge>
                </div>
                <div className="p-6">
                  <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
                </div>
              </div>
            )}

            {/* Choices */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '100ms', animationFillMode: 'both' }}
            >
              <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Варіанти відповідей
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {election.choices.map((choice, index) => {
                  const tallyItem = tally?.results.find((r) => r.choiceId === choice.id);
                  const pct = tally
                    ? tally.totalBallots > 0
                      ? Math.round(((tallyItem?.votes ?? 0) / tally.totalBallots) * 1000) / 10
                      : 0
                    : null;

                  return (
                    <div
                      key={choice.id}
                      className="flex items-center gap-4 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]"
                    >
                      <span className="w-8 h-8 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body shrink-0">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 text-sm font-body text-[var(--foreground)]">
                        {choice.choice}
                      </span>
                      {pct !== null && (
                        <div className="text-right shrink-0">
                          <span className="font-display text-lg font-bold text-[var(--foreground)]">
                            {pct}%
                          </span>
                          <p className="text-xs text-[var(--muted-foreground)] font-body">
                            {tallyItem?.votes ?? 0} голосів
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ballot chain integrity */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '150ms', animationFillMode: 'both' }}
            >
              <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  Ланцюжок бюлетенів
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    {
                      label: 'Всього бюлетенів',
                      value: election.ballotCount.toLocaleString('uk-UA'),
                      accent: 'text-[var(--kpi-navy)]',
                    },
                    {
                      label: 'Шифрування',
                      value: 'RSA-2048',
                      accent: 'text-[var(--kpi-blue-light)]',
                    },
                    {
                      label: 'Алгоритм хешу',
                      value: 'SHA-256',
                      accent: 'text-[var(--kpi-orange)]',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="text-center p-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]"
                    >
                      <p className={`font-display text-xl font-bold ${item.accent}`}>
                        {item.value}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)] font-body uppercase tracking-wider mt-1">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>

                <Alert variant="info">
                  Кожен бюлетень хешується та посилається на попередній, утворюючи незмінний
                  ланцюжок. Будь-яка спроба фальсифікації порушує ланцюжок і буде виявлена при
                  перевірці.
                </Alert>

                <div className="mt-4">
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/elections/${id}/ballots`}>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Переглянути всі бюлетені
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Timeline */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Розклад
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <TimelineItem
                  label="Створено"
                  value={formatDateTime(election.createdAt)}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  }
                  status="done"
                />
                <TimelineItem
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                    </svg>
                  }
                  status={election.status === 'upcoming' ? 'pending' : 'done'}
                />
                <TimelineItem
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                  }
                  status={isClosed ? 'done' : 'pending'}
                />
              </div>
            </div>

            {/* Access restrictions */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '250ms', animationFillMode: 'both' }}
            >
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Доступ
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-[var(--muted-foreground)]">
                    Факультет
                  </span>
                  {election.restrictedToFaculty ? (
                    <Badge variant="info" size="md">
                      {election.restrictedToFaculty}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md">
                      Всі
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-[var(--muted-foreground)]">Група</span>
                  {election.restrictedToGroup ? (
                    <Badge variant="secondary" size="md">
                      {election.restrictedToGroup}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md">
                      Всі
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Public key */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '300ms', animationFillMode: 'both' }}
            >
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Публічний ключ
                </h3>
                <CopyButton text={election.publicKey} />
              </div>
              <div className="p-5">
                <div className="p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
                  <p className="font-mono text-[10px] text-[var(--muted-foreground)] break-all leading-relaxed line-clamp-3">
                    {election.publicKey}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] font-body mt-2">
                  RSA-2048 SPKI · Використовується для шифрування бюлетенів
                </p>
              </div>
            </div>

            {/* Private key (only after closing) */}
            {isClosed && election.privateKey && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--kpi-orange)]/30 shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
                style={{ animationDelay: '350ms', animationFillMode: 'both' }}
              >
                <div className="px-5 py-4 border-b border-[var(--kpi-orange)]/20 flex items-center justify-between bg-[var(--warning-bg)]">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[var(--kpi-orange)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                      Приватний ключ
                    </h3>
                  </div>
                  <CopyButton text={election.privateKey} />
                </div>
                <div className="p-5">
                  <div className="p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
                    <p className="font-mono text-[10px] text-[var(--muted-foreground)] break-all leading-relaxed line-clamp-3">
                      {election.privateKey}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] font-body mt-2">
                    Розкрито після закриття · Використовується для розшифрування та перевірки
                  </p>
                </div>
              </div>
            )}

            {/* Quick links */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '400ms', animationFillMode: 'both' }}
            >
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Швидкі дії
                </h3>
              </div>
              <div className="p-3 space-y-1">
                {[
                  {
                    label: 'Публічна сторінка',
                    href: `/elections/${id}`,
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: 'Усі бюлетені',
                    href: `/elections/${id}/ballots`,
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    ),
                  },
                  {
                    label: 'Усі голосування',
                    href: '/admin/elections',
                    icon: (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    ),
                  },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] text-sm font-body font-medium text-[var(--foreground)] hover:bg-[var(--surface)] hover:text-[var(--kpi-navy)] transition-all duration-150"
                  >
                    <span className="text-[var(--muted-foreground)]">{action.icon}</span>
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  icon,
  status,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  status: 'done' | 'pending';
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          status === 'done'
            ? 'bg-[var(--kpi-navy)] text-white'
            : 'bg-[var(--surface)] text-[var(--kpi-gray-mid)] border border-[var(--border-subtle)]'
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-body font-semibold">
          {label}
        </p>
        <p className="text-sm font-body text-[var(--foreground)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}
