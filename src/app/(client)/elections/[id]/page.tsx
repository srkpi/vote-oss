import { Calendar, ChevronRight, Clock, Eye, EyeOff, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { CountdownTimer } from '@/components/elections/countdown-timer';
import { AccessRestrictions } from '@/components/elections/election-restrictions';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { InfoRow } from '@/components/elections/info-row';
import { KeyDisclosure } from '@/components/elections/key-disclosure';
import { RestrictedVoteBanner } from '@/components/elections/restricted-vote-banner';
import { ResultsSection } from '@/components/elections/results-section';
import { VoteStatusWrapper } from '@/components/elections/vote-status-wrapper';
import { WinningConditionsDisplay } from '@/components/elections/winning-conditions-display';
import { Button } from '@/components/ui/button';
import { LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserAvatarMenu } from '@/components/ui/user-avatar-menu';
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
  } else if (status === 400) {
    metaTitle = '400 | Некоректний ID голосування';
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

  const [session, groups, { data: election, error, status }] = await Promise.all([
    getServerSession(),
    serverApi.groups.list(),
    serverApi.elections.get(id),
  ]);

  const groupMember = groups.data?.map((group) => group.id) ?? null;

  if (!session) {
    redirect('/login');
  }

  if (status === 404) notFound();

  if (!election) {
    if (status === 403) {
      return (
        <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center bg-surface p-4">
          <div className="border-border-color w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">
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

  if (election.type === 'PETITION') {
    redirect(`/petitions/${election.id}`);
  }

  if (election.deletedAt) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center bg-surface p-4">
        <div className="border-border-color w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-sm">
          <ErrorState title="Голосування було видалено" />
        </div>
      </div>
    );
  }

  const isOpen = election.status === 'open';
  const isUpcoming = election.status === 'upcoming';
  const isClosed = election.status === 'closed';
  // Non-anonymous open elections expose live results; the API sets `votes`
  // on choices in that case too.
  const hasResults = election.choices.some((c) => c.votes !== undefined);
  const showLiveResults = isOpen && !election.anonymous && hasResults;

  const bypassedTypes = election.bypassedTypes ?? null;
  const canParticipate = checkRestrictionsWithBypass(
    election.restrictions,
    session,
    bypassedTypes,
    groupMember,
  );

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-surface">
      <div className="border-b border-border-subtle bg-card">
        <div className="container py-6">
          <nav className="font-body mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/elections" className="transition-colors hover:text-kpi-navy">
              Голосування
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-xs truncate text-foreground">{election.title}</span>
          </nav>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 space-y-3">
              <StatusBadge status={election.status} size="md" />
              <h1 className="font-display text-3xl leading-tight font-bold wrap-break-word text-foreground md:text-4xl">
                {election.title}
              </h1>
              <div className="font-body flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserAvatarMenu
                    icon
                    userId={election.createdBy.userId}
                    fullName={election.createdBy.fullName}
                    avatarUrl={election.createdBy.avatarUrl}
                    canDelete={session.isAdmin}
                    size={election.createdBy.avatarUrl ? 36 : 16}
                  />
                  {election.createdBy.fullName}
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
            {election.description && (
              <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-3 font-display text-xl font-semibold text-foreground">Опис</h2>
                <p className="font-body text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {election.description}
                </p>
              </div>
            )}

            {(isOpen || isUpcoming) && (
              <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
                <p className="font-body mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {isOpen ? 'Залишилось часу' : 'Починається через'}
                </p>
                <CountdownTimer targetDate={isOpen ? election.closesAt : election.opensAt} />
              </div>
            )}

            {isOpen && (
              <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
                {canParticipate ? (
                  <>
                    <h2 className="mb-5 font-display text-xl font-semibold text-foreground">
                      Ваш голос
                    </h2>
                    <VoteStatusWrapper election={election} />
                  </>
                ) : (
                  <RestrictedVoteBanner
                    restrictions={election.restrictions}
                    session={session}
                    bypassedTypes={bypassedTypes}
                    restrictedGroups={election.restrictedGroups}
                    groupMember={groupMember}
                  />
                )}
              </div>
            )}

            {(isClosed || showLiveResults) && hasResults && (
              <ResultsSection
                title={showLiveResults ? 'Поточні результати' : 'Результати'}
                choices={election.choices}
                totalBallots={election.ballotCount}
                electionId={election.id}
              />
            )}

            {isUpcoming && (
              <div className="border-border-color rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-4 font-display text-xl font-semibold text-foreground">
                  Варіанти відповідей
                </h2>
                <div className="space-y-2.5">
                  {election.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3.5"
                    >
                      <span className="font-body min-w-0 flex-1 text-sm wrap-break-word text-foreground">
                        {choice.choice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="border-border-color rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-display text-base font-semibold text-foreground">
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
                <InfoRow
                  icon={
                    election.anonymous ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )
                  }
                  label="Конфіденційність"
                  value={
                    election.anonymous ? (
                      'Анонімне голосування'
                    ) : (
                      <span className="font-semibold text-kpi-orange">
                        Неанонімне — ПІБ голосуючих видимі під час голосування
                      </span>
                    )
                  }
                />
              </div>
            </div>

            {election.restrictions.length > 0 && (
              <AccessRestrictions
                restrictions={election.restrictions}
                restrictedGroups={election.restrictedGroups}
              />
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

                {(isClosed || showLiveResults) && election.privateKey && (
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
