import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, User, FileText, Calendar, Clock, GraduationCap, Users } from 'lucide-react';
import { serverFetch } from '@/lib/server-auth';
import { VoteStatusWrapper } from '@/components/elections/vote-status-wrapper';
import { ResultsChart } from '@/components/elections/result-chart';
import { CountdownTimer } from '@/components/elections/countdown-timer';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { Badge } from '@/components/ui/badge';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import type { ElectionDetail } from '@/types/election';
import type { TallyResponse } from '@/types/tally';

interface ElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverFetch<ElectionDetail>(`/api/elections/${id}`);
  return { title: data?.title ?? 'Голосування' };
}

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;

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
            <ChevronRight className="w-3.5 h-3.5" />
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
                  <User className="w-4 h-4" />
                  {election.creator.full_name}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {election.ballotCount} бюлетенів
                </span>
              </div>
            </div>

            {isClosed && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/elections/${id}/ballots`}>
                  <FileText className="w-3.5 h-3.5" />
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

            {/*
              Vote form / already-voted state (open elections).
              VoteStatusWrapper is a client component that reads localStorage
              and renders either the VoteForm or the AlreadyVotedCard.
            */}
            {isOpen && (
              <div
                className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 animate-fade-up"
                style={{ animationDelay: '100ms' }}
              >
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-5">
                  Ваш голос
                </h2>
                <VoteStatusWrapper election={election} />
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
                  <Clock className="w-3.5 h-3.5" />
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
                  icon={<Calendar className="w-4 h-4" />}
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                />
                <InfoRow
                  icon={<Clock className="w-4 h-4" />}
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                />
                {election.restrictedToFaculty && (
                  <InfoRow
                    icon={<GraduationCap className="w-4 h-4" />}
                    label="Факультет"
                    value={election.restrictedToFaculty}
                  />
                )}
                {election.restrictedToGroup && (
                  <InfoRow
                    icon={<Users className="w-4 h-4" />}
                    label="Група"
                    value={election.restrictedToGroup}
                  />
                )}
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
