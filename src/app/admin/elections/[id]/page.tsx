import { ChevronRight, ExternalLink, FileText, Play, Plus, StopCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { ResultsChart } from '@/components/elections/result-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serverFetch } from '@/lib/server-auth';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { ElectionDetail } from '@/types/election';
import type { TallyResponse } from '@/types/tally';

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
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="animate-fade-down">
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-3 sm:mb-4">
            <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
              Адмін
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link
              href="/admin/elections"
              className="hover:text-[var(--kpi-navy)] transition-colors"
            >
              Голосування
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[var(--foreground)] truncate max-w-[120px] sm:max-w-xs">
              {election.title}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="space-y-2 min-w-0">
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
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)] leading-tight">
                {election.title}
              </h1>
              <p className="text-xs sm:text-sm font-body text-[var(--muted-foreground)]">
                Створено: {election.creator.full_name} ({election.creator.faculty}) ·{' '}
                {formatDate(election.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/elections/${id}/ballots`}>
                  <FileText className="w-3.5 h-3.5" />
                  Бюлетені
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/elections/${id}`}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Публічна сторінка</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Live indicator for open elections */}
            {isOpen && (
              <div
                className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-[var(--radius-xl)] bg-[var(--success-bg)] border border-[var(--success)]/20 animate-fade-up"
                style={{ animationFillMode: 'both' }}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--success)] flex items-center justify-center shrink-0">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm sm:text-base font-semibold text-[var(--success)]">
                    Голосування активне
                  </p>
                  <p className="text-xs sm:text-sm font-body text-[var(--success)]/80 mt-0.5">
                    Завершується {formatDateTime(election.closesAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-[var(--success)]">
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
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                    Результати голосування
                  </h2>
                  <Badge variant="secondary" size="md">
                    {tally.totalBallots} бюлетенів
                  </Badge>
                </div>
                <div className="p-4 sm:p-6">
                  <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
                </div>
              </div>
            )}

            {/* Choices */}
            {!isClosed && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
                style={{ animationDelay: '100ms', animationFillMode: 'both' }}
              >
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                    Варіанти відповідей
                  </h2>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
                  {election.choices.map((choice, index) => (
                    <div
                      key={choice.id}
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]"
                    >
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body shrink-0">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 text-sm font-body text-[var(--foreground)]">
                        {choice.choice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Timeline */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <div className="p-4 sm:p-5 space-y-4">
                <TimelineItem
                  label="Створено"
                  value={formatDateTime(election.createdAt)}
                  icon={<Plus className="w-4 h-4" />}
                  status="done"
                />
                <TimelineItem
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                  icon={<Play className="w-4 h-4" />}
                  status={election.status === 'upcoming' ? 'pending' : 'done'}
                />
                <TimelineItem
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                  icon={<StopCircle className="w-4 h-4" />}
                  status={isClosed ? 'done' : 'pending'}
                />
              </div>
            </div>

            {/* Access restrictions */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden animate-fade-up"
              style={{ animationDelay: '250ms', animationFillMode: 'both' }}
            >
              <div className="px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Доступ
                </h3>
              </div>
              <div className="p-4 sm:p-5 space-y-3">
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

            <EncryptionKey
              title="Публічний ключ"
              description="RSA-2048 SPKI · Використовується для шифрування бюлетенів"
              keyValue={election.publicKey}
            />

            {isClosed && election.privateKey && (
              <EncryptionKey
                isPrivate
                title="Приватний ключ"
                description="Використовується для розшифрування та перевірки"
                keyValue={election.privateKey}
              />
            )}
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
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${status === 'done' ? 'bg-[var(--kpi-navy)] text-white' : 'bg-[var(--surface)] text-[var(--kpi-gray-mid)] border border-[var(--border-subtle)]'}`}
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
