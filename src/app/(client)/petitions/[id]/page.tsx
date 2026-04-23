import { Calendar, Clock, Megaphone, User } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { ElectionStatusBadge } from '@/components/elections/election-status-badge';
import { PetitionAdminActions } from '@/components/petitions/petition-admin-actions';
import { SignPetitionPanel } from '@/components/petitions/sign-petition-panel';
import { Badge } from '@/components/ui/badge';
import { LocalDate, LocalDateTime } from '@/components/ui/local-time';
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

  const pct = Math.min(100, Math.round((petition.ballotCount / PETITION_QUORUM) * 100));
  const reached = petition.ballotCount >= PETITION_QUORUM;
  const canSign = petition.approved && petition.status === 'open';

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        nav={[{ label: 'Петиції', href: '/petitions' }, { label: petition.title }]}
        title={petition.title}
        isContainer
      />
      <div className="container py-8">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="navy-gradient flex h-8 w-8 items-center justify-center rounded-lg">
                  <Megaphone className="h-4 w-4 text-white" />
                </div>
                {petition.approved ? (
                  <ElectionStatusBadge status={petition.status} />
                ) : (
                  <Badge variant="warning">Очікує апруву</Badge>
                )}
                {reached && <Badge variant="success">Досягнуто кворум</Badge>}
              </div>

              <h1 className="font-display text-foreground text-2xl leading-tight font-semibold sm:text-3xl">
                {petition.title}
              </h1>

              <div className="font-body text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {petition.createdBy.fullName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <LocalDateTime date={petition.createdAt} />
                </span>
                {petition.approved && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    діє до <LocalDate date={petition.closesAt} />
                  </span>
                )}
              </div>

              {petition.description && (
                <div className="font-body text-foreground mt-6 text-sm leading-relaxed whitespace-pre-wrap">
                  {petition.description}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
              <p className="font-display text-foreground mb-2 text-base font-semibold">
                Підтримка петиції
              </p>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="font-body text-muted-foreground text-sm">
                  <strong className="text-foreground text-lg">{petition.ballotCount}</strong> /{' '}
                  {PETITION_QUORUM}
                </span>
                <span className="font-body text-foreground text-sm font-semibold">{pct}%</span>
              </div>
              <div className="bg-surface h-2 w-full overflow-hidden rounded-full">
                <div
                  className={
                    reached
                      ? 'bg-kpi-green h-full rounded-full transition-all duration-500'
                      : 'bg-kpi-navy h-full rounded-full transition-all duration-500'
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="font-body text-muted-foreground mt-2 text-xs">
                Петиція автоматично закриється після {PETITION_QUORUM} підписів.
              </p>
            </div>

            {canSign && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <SignPetitionPanel petition={petition} />
              </div>
            )}

            {!petition.approved && (
              <div className="border-border-color shadow-shadow-sm rounded-xl border bg-white p-5">
                <p className="font-display text-foreground mb-1 text-sm font-semibold">
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
                <p className="font-display text-foreground text-sm font-semibold">
                  {reached ? 'Петиція зібрала кворум' : 'Петиція завершена'}
                </p>
                <p className="font-body text-muted-foreground mt-1 text-sm">
                  {reached
                    ? 'Дякуємо всім, хто підписав. Її направлено на розгляд.'
                    : 'Кворум у ' + PETITION_QUORUM + ' підписів не досягнуто.'}
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

            <div className="font-body text-muted-foreground text-center text-xs">
              <Link href="/petitions" className="hover:text-foreground transition-colors">
                ← До всіх петицій
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
