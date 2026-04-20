import { Calendar, ChevronRight, Clock, FileText, User } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { CountdownTimer } from '@/components/elections/countdown-timer';
import { AccessRestrictions } from '@/components/elections/election-restrictions';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { InfoRow } from '@/components/elections/info-row';
import { KeyDisclosure } from '@/components/elections/key-disclosure';
import { RestrictedVoteBanner } from '@/components/elections/restricted-vote-banner';
import { ResultsChart } from '@/components/elections/result-chart';
import { VoteStatusWrapper } from '@/components/elections/vote-status-wrapper';
import { WinningConditionsDisplay } from '@/components/elections/winning-conditions-display';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { serverApi } from '@/lib/api/server';
import { APP_URL } from '@/lib/config/client';
import { checkRestrictionsWithBypass } from '@/lib/restrictions';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { pluralize } from '@/lib/utils/common';

interface ElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data, status } = await serverApi.elections.og(id);

  let metaTitle = 'Голосування';
  if (status === 404) {
    metaTitle = '404 | Голосування не знайдено';
  } else if (data?.title) {
    metaTitle = data.title;
  }

  return {
    title: metaTitle,
    description: metaTitle,
    openGraph: {
      title: metaTitle,
      description: metaTitle,
      url: new URL(`/elections/${id}`, APP_URL),
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaTitle,
    },
  };
}

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { id } = await params;

  if (await isBotRequest()) return null;

  const [session, { data: election, error, status }] = await Promise.all([
    getServerSession(),
    serverApi.elections.get(id),
  ]);

  if (!session) {
    redirect('/login');
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

  if (election.deletedAt) {
    return (
      <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <ErrorState title="Голосування було видалено" />
        </div>
      </div>
    );
  }

  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';
  const hasResults = isClosed && election.choices.some((c) => c.votes !== undefined);

  const bypassedTypes = election.bypassedTypes ?? null;
  const canParticipate = checkRestrictionsWithBypass(election.restrictions, session, bypassedTypes);

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
              <ElectionStatusBadge status={election.status} size="md" />
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
                    {pluralize(election.ballotCount, ['бюлетень', 'бюлетені', 'бюлетенів'])}
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
                {canParticipate ? (
                  <>
                    <h2 className="font-display text-foreground mb-5 text-xl font-semibold">
                      Ваш голос
                    </h2>
                    <VoteStatusWrapper election={election} />
                  </>
                ) : (
                  <RestrictedVoteBanner
                    restrictions={election.restrictions}
                    session={session}
                    bypassedTypes={bypassedTypes}
                  />
                )}
              </div>
            )}

            {isClosed && hasResults && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                <h2 className="font-display text-foreground mb-5 text-xl font-semibold">
                  Результати
                </h2>
                <ResultsChart
                  choices={election.choices}
                  totalBallots={election.ballotCount}
                  electionId={election.id}
                />
              </div>
            )}

            {isUpcoming && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6">
                <h2 className="font-display text-foreground mb-4 text-xl font-semibold">
                  Варіанти відповідей
                </h2>
                <div className="space-y-2.5">
                  {election.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className="border-border-subtle bg-surface flex items-center gap-3 rounded-lg border p-3.5"
                    >
                      <span className="font-body text-foreground min-w-0 flex-1 text-sm wrap-break-word">
                        {choice.choice}
                      </span>
                    </div>
                  ))}
                </div>
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
                  value={<LocalDateTime date={election.opensAt} />}
                />
                <InfoRow
                  icon={<Clock className="h-4 w-4" />}
                  label="Завершення"
                  value={<LocalDateTime date={election.closesAt} />}
                />
              </div>
            </div>

            {election.restrictions.length > 0 && (
              <AccessRestrictions restrictions={election.restrictions} />
            )}

            <WinningConditionsDisplay
              conditions={election.winningConditions}
              choicesCount={election.choices.length}
            />

            <KeyDisclosure>
              <div className="space-y-5">
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
            </KeyDisclosure>
          </div>
        </div>
      </div>
    </div>
  );
}
