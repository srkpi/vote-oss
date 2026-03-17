import { Calendar, ChevronRight, Clock, FileText, GraduationCap, User, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { CountdownTimer } from '@/components/elections/countdown-timer';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { InfoRow } from '@/components/elections/info-row';
import { ResultsChart } from '@/components/elections/result-chart';
import { VoteStatusWrapper } from '@/components/elections/vote-status-wrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { formatDateTime } from '@/lib/utils';
import type { TallyResponse } from '@/types/tally';

interface ElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverApi.getElection(id);
  return { title: data?.title ?? 'Голосування' };
}

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;

  const [session, { data: election, error, status }] = await Promise.all([
    getServerSession(),
    serverApi.getElection(id),
  ]);

  if (!session) {
    redirect('/auth/login');
  }

  if (status === 404) notFound();

  if (!election) {
    if (status === 403) {
      return (
        <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)] flex items-center justify-center p-4">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden w-full max-w-md">
            <ErrorState
              title={status === 403 ? 'Доступ обмежено' : 'Помилка завантаження'}
              description={
                status === 403
                  ? 'У вас немає доступу до цього голосування'
                  : (error ?? 'Не вдалося завантажити дані голосування')
              }
            />
          </div>
        </div>
      );
    }
    notFound();
  }

  // Fetch tally only for closed elections
  let tally: TallyResponse | null = null;
  if (election.status === 'closed') {
    const { data } = await serverApi.getTally(id);
    tally = data;
  }

  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)]">
      <div className="bg-white border-b border-[var(--border-subtle)]">
        <div className="container py-6">
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-4">
            <Link href="/elections" className="hover:text-[var(--kpi-navy)] transition-colors">
              Голосування
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[var(--foreground)] truncate max-w-xs">{election.title}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3 min-w-0">
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
              <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight break-words">
                {election.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted-foreground)] font-body">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {election.creator.full_name}
                </span>

                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/elections/${id}/ballots`}>
                    <FileText className="w-3.5 h-3.5" />
                    {election.ballotCount} бюлетенів
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {(isOpen || isUpcoming) && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider font-body mb-4">
                  {isOpen ? 'Залишилось часу' : 'Починається через'}
                </p>
                <CountdownTimer targetDate={isOpen ? election.closesAt : election.opensAt} />
              </div>
            )}

            {isOpen && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6">
                {(election.restrictedToFaculty &&
                  session.faculty != election.restrictedToFaculty) ||
                (election.restrictedToGroup && session.group != election.restrictedToGroup) ? (
                  <ErrorState title="Ви не можете брати участь у цьому опитуванні" />
                ) : (
                  <>
                    <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-5">
                      Ваш голос
                    </h2>
                    <VoteStatusWrapper election={election} />
                  </>
                )}
              </div>
            )}

            {isClosed && tally && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6">
                <h2 className="font-display text-xl font-semibold text-[var(--foreground)] mb-5">
                  Результати
                </h2>
                <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
              </div>
            )}

            {isUpcoming && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6">
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

          <div className="space-y-5">
            <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-5">
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
                    label="Підрозділ"
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
