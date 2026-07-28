import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { PetitionAdminActions } from '@/components/petitions/petition-admin-actions';
import { PetitionOfficialAnswer } from '@/components/petitions/petition-official-answer';
import { PetitionStatusNotice } from '@/components/petitions/petition-status-notice';
import { PetitionSupportBanner } from '@/components/petitions/petition-support-banner';
import { PetitionTabs } from '@/components/petitions/petition-tabs';
import { SignPetitionPanel } from '@/components/petitions/sign-petition-panel';
import { LocalDate } from '@/components/ui/local-time';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserAvatarMenu } from '@/components/ui/user-avatar-menu';
import { serverApi } from '@/lib/api/server';
import { PETITION_QUORUM } from '@/lib/constants';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { cn } from '@/lib/utils/common';
import { linkifyText } from '@/lib/utils/linkify';

interface PetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function PetitionPage({ params }: PetitionPageProps) {
  const { id } = await params;

  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) redirect('/login');

  const { data: petition, error, status } = await serverApi.elections.get(id);
  if (!petition) {
    if (status === 404) notFound();
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-error text-sm">{error ?? 'Не вдалося завантажити петицію'}</p>
      </div>
    );
  }

  const isPetitionManager = Boolean(session.isAdmin && session.managePetitions);
  const isOwner = petition.createdBy.userId === session.userId;
  const canApprove = isPetitionManager && !petition.approved;
  const canDelete = isPetitionManager;
  const canSeeTabs = petition.approved || isPetitionManager || isOwner;
  const ballotsResult = canSeeTabs
    ? await serverApi.elections.getSignatories(id)
    : { data: null, error: null };

  const quorum = petition.winningConditions?.quorum ?? PETITION_QUORUM;
  const reached = petition.ballotCount >= quorum;
  const isOpen = petition.status === 'open' && !petition.deletedBy;
  const isPending = !petition.approved;

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        nav={[{ label: 'Петиції', href: '/petitions' }, { label: petition.title }]}
        title={petition.title}
        isContainer
      />

      <div className="container grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <div className="border-border-color shadow-card relative overflow-hidden rounded-xl border bg-white p-6 sm:p-8">
            <div
              className={cn(
                'absolute inset-x-0 top-0 h-1',
                isOpen && !reached && 'from-success bg-linear-to-r to-emerald-400',
                reached && 'from-kpi-blue-light bg-linear-to-r to-blue-400',
                isPending && !petition.deletedBy && 'from-kpi-orange bg-linear-to-r to-amber-400',
                petition.deletedBy && 'bg-linear-to-r from-rose-400 to-rose-300',
                !isPending &&
                  !isOpen &&
                  !petition.deletedBy &&
                  !reached &&
                  'from-kpi-gray-light bg-linear-to-r to-gray-300',
              )}
            />

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {isPending && <StatusBadge status="pending" />}
              {!isPending && !isOpen && reached && <StatusBadge status="quorum" />}
              {!isPending && !isOpen && !reached && <StatusBadge status="closed" />}
              {!isPending && isOpen && <StatusBadge status="open" />}
            </div>

            <h1 className="font-display mb-4 text-2xl leading-tight font-bold wrap-break-word sm:text-3xl">
              {petition.title}
            </h1>

            <div className="text-muted-foreground mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="flex items-center gap-2">
                <UserAvatarMenu
                  icon
                  userId={petition.createdBy.userId}
                  avatarUrl={petition.createdBy.avatarUrl}
                  fullName={petition.createdBy.fullName}
                  canDelete={session.isAdmin}
                  size={petition.createdBy.avatarUrl ? 36 : 16}
                />
                <span className="truncate font-medium">{petition.createdBy.fullName}</span>
              </span>
              <span className="text-border-color">·</span>
              <LocalDate date={petition.createdAt} />
            </div>

            <div className="font-body max-w-[68ch] text-[15px] leading-relaxed wrap-break-word whitespace-pre-wrap">
              {linkifyText(petition.description ?? '')}
            </div>
          </div>

          <PetitionOfficialAnswer
            electionId={petition.id}
            answer={petition.officialAnswer}
            canManage={isPetitionManager}
          />

          <div className="space-y-6 lg:hidden">
            <PetitionSupportBanner ballotCount={petition.ballotCount} quorum={quorum} />
            <SignPetitionPanel petition={petition} />
            <PetitionStatusNotice approved={petition.approved} deleted={!!petition.deletedAt} />
            <PetitionAdminActions
              petitionId={petition.id}
              canApprove={canApprove}
              canDelete={canDelete}
              canManageDiscussion={isPetitionManager}
              discussionClosed={petition.commentsClosed}
            />
          </div>

          {canSeeTabs ? (
            <PetitionTabs
              electionId={petition.id}
              ballotsData={ballotsResult.data}
              ballotsError={ballotsResult.error}
              commentsData={petition.initialComments}
              commentsError={null}
              discussionClosed={petition.commentsClosed}
              commentCount={petition.commentCount}
              supporterCount={petition.ballotCount}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              Коментарі та список прихильників стануть доступні після підтвердження петиції.
            </p>
          )}
        </div>

        <aside className="hidden space-y-6 lg:block">
          <PetitionSupportBanner ballotCount={petition.ballotCount} quorum={quorum} />
          <SignPetitionPanel petition={petition} />
          <PetitionStatusNotice approved={petition.approved} deleted={!!petition.deletedAt} />
          <PetitionAdminActions
            petitionId={petition.id}
            canApprove={canApprove}
            canDelete={canDelete}
            canManageDiscussion={isPetitionManager}
            discussionClosed={petition.commentsClosed}
          />
        </aside>
      </div>
    </div>
  );
}
