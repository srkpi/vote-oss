import { Calendar, Clock, User } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { PetitionAdminActions } from '@/components/petitions/petition-admin-actions';
import { PetitionSignatories } from '@/components/petitions/petition-signatories';
import { SignPetitionPanel } from '@/components/petitions/sign-petition-panel';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { serverApi } from '@/lib/api/server';
import { APP_URL } from '@/lib/config/client';
import { PETITION_QUORUM } from '@/lib/constants';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';

interface PetitionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PetitionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data, status } = await serverApi.elections.og(id);
  const title = status === 404 ? '404 | Петицію не знайдено' : (data?.title ?? 'Петиція');
  return {
    title,
    description: title,
    openGraph: { title, description: title, url: new URL(`/petitions/${id}`, APP_URL) },
    twitter: { card: 'summary_large_image', title, description: title },
  };
}

export default async function PetitionPage({ params }: PetitionPageProps) {
  const { id } = await params;

  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { data: petition, error, status } = await serverApi.elections.get(id);

  const signatoriesResult =
    petition && petition.type === 'PETITION' && petition.approved && !petition.deletedAt
      ? await serverApi.elections.getSignatories(id)
      : null;

  if (status === 404) notFound();
  if (!petition) {
    return (
      <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <ErrorState
            title={status === 403 ? 'Доступ обмежено' : 'Помилка завантаження'}
            description={error ?? 'Не вдалося завантажити дані петиції'}
          />
        </div>
      </div>
    );
  }

  // If a non-petition ID was used, redirect to election page
  if (petition.type !== 'PETITION') {
    redirect(`/elections/${petition.id}`);
  }

  if (petition.deletedAt) {
    return (
      <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <ErrorState title="Петицію було видалено" />
        </div>
      </div>
    );
  }

  const isCreator = petition.createdBy.userId === session.userId;
  const isPetitionManager = session.isAdmin && session.managePetitions;
  const canApprove = isPetitionManager && !petition.approved;
  const canDelete = isPetitionManager;

  const quorum = petition.winningConditions.quorum ?? PETITION_QUORUM;
  const pct = Math.min(100, Math.round((petition.ballotCount / quorum) * 100));
  const reached = petition.ballotCount >= quorum;
  const canSign = petition.approved && petition.status === 'open';

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        nav={[{ label: 'Петиції', href: '/petitions' }, { label: petition.title }]}
        title={petition.title}
        isContainer
      />
      <div className="container py-8">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <div className="border-border-color shadow-shadow-sm min-w-0 rounded-xl border bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                {petition.approved ? (
                  petition.status !== 'closed' && <StatusBadge status={petition.status} />
                ) : (
                  <StatusBadge status="pending" />
                )}
                {reached && <StatusBadge status="quorum" />}
              </div>

              <div className="font-body text-muted-foreground mt-4 space-y-1 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{petition.createdBy.fullName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <LocalDateTime date={petition.createdAt} />
                </span>
                {petition.approved && !reached && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    діє до <LocalDate date={petition.closesAt} />
                  </span>
                )}
              </div>

              {petition.description && (
                <div className="font-body text-foreground mt-6 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
                  {petition.description}
                </div>
              )}
            </div>

            {petition.approved && (
              <PetitionSignatories
                ballotCount={petition.ballotCount}
                initialData={signatoriesResult?.data ?? null}
                fetchError={signatoriesResult?.error ?? null}
              />
            )}
          </div>

          <aside className="space-y-4">
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
              <p className="font-display text-foreground mb-2 text-base font-semibold">
                Підтримка петиції
              </p>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="font-body text-muted-foreground text-sm">
                  <strong className="text-foreground text-lg">{petition.ballotCount}</strong> /{' '}
                  {quorum}
                </span>
                <span className="font-body text-foreground text-sm font-semibold">{pct}%</span>
              </div>
              <div className="bg-surface h-2 w-full overflow-hidden rounded-full">
                <div
                  className={
                    reached
                      ? 'bg-kpi-navy h-full rounded-full transition-all duration-500'
                      : 'bg-kpi-navy h-full rounded-full transition-all duration-500'
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="font-body text-muted-foreground mt-2 text-xs">
                Петиція автоматично закриється після {quorum} підписів.
              </p>
            </div>

            {canSign && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <SignPetitionPanel petition={petition} />
              </div>
            )}

            {!petition.approved && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <p className="font-display text-foreground mb-2 text-base font-semibold">
                  Петиція очікує апруву
                </p>
                <p className="font-body text-muted-foreground text-sm">
                  {isCreator
                    ? 'Адміністратор перевірить вашу петицію і затвердить її або видалить.'
                    : 'Адміністратор ще не затвердив цю петицію.'}
                </p>
              </div>
            )}

            {petition.approved && petition.status === 'closed' && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <p className="font-display text-foreground mb-2 text-base font-semibold">
                  {reached ? 'Петиція зібрала кворум' : 'Петиція завершена'}
                </p>
                <p className="font-body text-muted-foreground mt-1 text-sm">
                  {reached
                    ? 'Дякуємо всім, хто підписав. Її направлено на розгляд.'
                    : 'Кворум у ' + quorum + ' підписів не досягнуто.'}
                </p>
              </div>
            )}

            {(canApprove || canDelete) && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <PetitionAdminActions
                  petitionId={petition.id}
                  approved={petition.approved}
                  canApprove={canApprove}
                  canDelete={canDelete}
                />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
