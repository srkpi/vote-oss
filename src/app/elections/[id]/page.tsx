import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { VoteForm } from '@/components/elections/vote-form';
import { ResultsChart } from '@/components/elections/result-chart';
import { CountdownTimer } from '@/components/elections/countdown-timer';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import type { ElectionDetail, TallyResponse } from '@/types';

interface ElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverFetch<ElectionDetail>(`/api/elections/${id}`);
  return {
    title: data?.title ?? 'Голосування',
  };
}

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const {
    data: election,
    error,
    status,
  } = await serverFetch<ElectionDetail>(`/api/elections/${id}`);

  if (status === 404 || !election) notFound();
  if (error && status !== 403) {
    return (
      <div className="container py-20 text-center">
        <p className="text-[var(--error)] font-body">{error}</p>
      </div>
    );
  }

  // Fetch tally only for closed elections
  let tally: TallyResponse | null = null;
  if (election.status === 'closed') {
    const { data } = await serverFetch<TallyResponse>(`/api/elections/${id}/tally`);
    tally = data;
  }

  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border-subtle)]">
        <div className="container py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-4 animate-fade-down">
            <Link href="/elections" className="hover:text-[var(--kpi-navy)] transition-colors">
              Голосування
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--foreground)] truncate max-w-xs">{election.title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-fade-up">
            <div className="space-y-3">
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
              <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
                {election.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)] font-body">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {election.creator.full_name}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {election.ballotCount} бюлетенів
                </span>
              </div>
            </div>

            {isClosed && (
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
                  Всі бюлетені
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: main action area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Countdown timer */}
            {(isOpen || isUpcoming) && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 animate-fade-up"
                style={{ animationDelay: '50ms' }}
              >
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-4">
                  {isOpen ? 'Залишилось часу' : 'Починається через'}
                </p>
                <CountdownTimer targetDate={isOpen ? election.closesAt : election.opensAt} />
              </div>
            )}

            {/* Vote form (open elections) */}
            {isOpen && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 animate-fade-up"
                style={{ animationDelay: '100ms' }}
              >
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-5">
                  Ваш голос
                </h2>
                <VoteForm election={election} />
              </div>
            )}

            {/* Results (closed elections) */}
            {isClosed && tally && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 animate-fade-up"
                style={{ animationDelay: '100ms' }}
              >
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-5">
                  Результати
                </h2>
                <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
              </div>
            )}

            {/* Preview choices (upcoming) */}
            {isUpcoming && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 animate-fade-up"
                style={{ animationDelay: '100ms' }}
              >
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-4">
                  Варіанти відповідей
                </h2>
                <div className="space-y-2.5">
                  {election.choices.map((choice, index) => (
                    <div
                      key={choice.id}
                      className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]"
                    >
                      <span className="w-7 h-7 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body shrink-0">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-sm font-body text-[var(--foreground)]">
                        {choice.choice}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] font-body mt-4 flex items-center gap-1.5">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Голосування розпочнеться {formatDateTime(election.opensAt)}
                </p>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <div className="space-y-5">
            {/* Election info */}
            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-5 animate-fade-up"
              style={{ animationDelay: '150ms' }}
            >
              <h3 className="font-display text-base font-semibold text-[var(--foreground)] mb-4">
                Деталі голосування
              </h3>
              <div className="space-y-3.5">
                <InfoRow
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  }
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                />
                <InfoRow
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                />
                <InfoRow
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  }
                  label="Бюлетенів"
                  value={election.ballotCount.toString()}
                />
                {election.restrictedToFaculty && (
                  <InfoRow
                    icon={
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
                          d="M12 14l9-5-9-5-9 5 9 5z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                        />
                      </svg>
                    }
                    label="Факультет"
                    value={election.restrictedToFaculty}
                  />
                )}
                {election.restrictedToGroup && (
                  <InfoRow
                    icon={
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
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    }
                    label="Група"
                    value={election.restrictedToGroup}
                  />
                )}
              </div>
            </div>

            {/* Security info */}
            <div
              className="navy-gradient rounded-[var(--radius-xl)] p-5 animate-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              <h3 className="font-display text-base font-semibold text-white mb-3">Безпека</h3>
              <div className="space-y-2.5">
                {['RSA-2048 шифрування', 'Нульові знання', 'Публічна перевірка'].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-white/80 font-body"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--kpi-orange)] shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-5 animate-fade-up"
              style={{ animationDelay: '250ms' }}
            >
              <h3 className="font-display text-base font-semibold text-[var(--foreground)] mb-2">
                Публічний ключ
              </h3>
              <div className="p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
                <textarea
                  readOnly
                  className="font-mono text-[10px] text-[var(--muted-foreground)] break-all leading-relaxed w-full h-20 border border-gray-300 rounded p-2 resize-none"
                  value={election.publicKey}
                />
              </div>
            </div>

            {/* Private key (after close) */}
            {isClosed && election.privateKey && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-5 animate-fade-up"
                style={{ animationDelay: '250ms' }}
              >
                <h3 className="font-display text-base font-semibold text-[var(--foreground)] mb-2">
                  Приватний ключ
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] font-body mb-3 leading-relaxed">
                  Ключ розкрито після завершення — можна перевірити розшифрування бюлетенів.
                </p>
                <div className="p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
                  <textarea
                    readOnly
                    className="font-mono text-[10px] text-[var(--muted-foreground)] break-all leading-relaxed w-full h-20 border border-gray-300 rounded p-2 resize-none"
                    value={election.privateKey}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-[var(--kpi-gray-mid)] shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-body font-semibold leading-tight">
          {label}
        </p>
        <p className="text-sm text-[var(--foreground)] font-body mt-0.5 leading-snug">{value}</p>
      </div>
    </div>
  );
}
