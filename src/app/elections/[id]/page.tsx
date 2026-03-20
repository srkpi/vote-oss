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
        <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
          <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
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
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <div className="border-border-subtle border-b bg-white">
        <div className="container py-6">
          <nav className="font-body text-muted-foreground mb-4 flex items-center gap-2 text-sm">
            <Link href="/elections" className="hover:text-kpi-navy transition-colors">
              Голосування
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground max-w-xs truncate">{election.title}</span>
          </nav>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 space-y-3">
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
              <h1 className="font-display text-foreground text-3xl leading-tight font-bold wrap-break-word md:text-4xl">
                {election.title}
              </h1>
              <div className="font-body text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {election.creator.fullName}
                </span>

                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/elections/${id}/ballots`}>
                    <FileText className="h-3.5 w-3.5" />
                    {election.ballotCount} бюлетенів
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {(isOpen || isUpcoming) && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                <p className="font-body text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
                  {isOpen ? 'Залишилось часу' : 'Починається через'}
                </p>
                <CountdownTimer targetDate={isOpen ? election.closesAt : election.opensAt} />
              </div>
            )}

            {isOpen && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                {(election.restrictedToFaculty &&
                  session.faculty != election.restrictedToFaculty) ||
                (election.restrictedToGroup && session.group != election.restrictedToGroup) ? (
                  <ErrorState title="Ви не можете брати участь у цьому опитуванні" />
                ) : (
                  <>
                    <h2 className="font-display text-foreground mb-5 text-xl font-semibold">
                      Ваш голос
                    </h2>
                    <VoteStatusWrapper election={election} />
                  </>
                )}
              </div>
            )}

            {isClosed && tally && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                <h2 className="font-display text-foreground mb-5 text-xl font-semibold">
                  Результати
                </h2>
                <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
              </div>
            )}

            {isUpcoming && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                <h2 className="font-display text-foreground mb-4 text-xl font-semibold">
                  Варіанти відповідей
                </h2>
                <div className="space-y-2.5">
                  {election.choices.map((choice, index) => (
                    <div
                      key={choice.id}
                      className="border-border-subtle bg-surface flex items-center gap-3 rounded-lg border p-3.5"
                    >
                      <span className="navy-gradient font-body flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="font-body text-foreground text-sm">{choice.choice}</span>
                    </div>
                  ))}
                </div>
                <p className="font-body text-muted-foreground mt-4 flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  Голосування розпочнеться {formatDateTime(election.opensAt)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
              <h3 className="font-display text-foreground mb-4 text-base font-semibold">
                Деталі голосування
              </h3>
              <div className="space-y-3.5">
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                />
                {election.restrictedToFaculty && (
                  <InfoRow
                    icon={<GraduationCap className="h-4 w-4" />}
                    label="Підрозділ"
                    value={election.restrictedToFaculty}
                  />
                )}
                {election.restrictedToGroup && (
                  <InfoRow
                    icon={<Users className="h-4 w-4" />}
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
