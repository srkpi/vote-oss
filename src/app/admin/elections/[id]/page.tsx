import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Play,
  Plus,
  RotateCcw,
  StopCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { DeleteElectionButton } from '@/components/elections/admin/delete-election-button';
import { RestoreElectionButton } from '@/components/elections/admin/restore-election-button';
import { AccessRestrictions } from '@/components/elections/election-restrictions';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { ResultsChart } from '@/components/elections/result-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimelineItem } from '@/components/ui/timeline-item';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { formatDateTime, pluralize } from '@/lib/utils';

interface AdminElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverApi.elections.get(id);
  return { title: data?.title ? `${data.title} — Деталі` : 'Деталі голосування' };
}

export default async function AdminElectionDetailPage({ params }: AdminElectionPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  const { data: election, status } = await serverApi.elections.get(id);

  if (status === 404 || !election) notFound();

  // canDelete and canRestore come pre-computed from the API (hierarchy-aware).
  const canDelete = election.canDelete ?? false;
  const canRestore = election.canRestore ?? false;
  const isDeleted = !!election.deletedAt;

  const results = election.results ?? null;
  const isClosed = election.status === 'closed';
  const isOpen = election.status === 'open';

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        nav={[
          { label: 'Адмін', href: '/admin' },
          { label: 'Голосування', href: '/admin/elections' },
          { label: election.title },
        ]}
        title={election.title}
      >
        <div className="flex items-center gap-2">
          {!isDeleted && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/elections/${id}/ballots`}>
                <FileText className="h-3.5 w-3.5" />
                Бюлетені
              </Link>
            </Button>
          )}
          {!isDeleted && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/elections/${id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
          {canRestore && <RestoreElectionButton electionId={id} electionTitle={election.title} />}
          {canDelete && !isDeleted && (
            <DeleteElectionButton electionId={id} electionTitle={election.title} hiddenLabel />
          )}
        </div>
      </PageHeader>

      <div className="p-4 sm:p-8">
        {/* Soft-deleted banner */}
        {isDeleted && election.deletedBy && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:gap-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-red-700 sm:text-base">
                Голосування видалено
              </p>
              <p className="font-body mt-0.5 text-xs text-red-600/80 sm:text-sm">
                Видалив(-ла) <span className="font-semibold">{election.deletedBy.fullName}</span>
                {election.deletedAt ? ` · ${formatDateTime(election.deletedAt)}` : ''}
              </p>
              {canRestore && (
                <div className="mt-2">
                  <RestoreElectionButton
                    electionId={id}
                    electionTitle={election.title}
                    variant="inline"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {isOpen && !isDeleted && (
              <div className="border-success/20 bg-success-bg flex items-center gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5">
                <div className="bg-success flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-success text-sm font-semibold sm:text-base">
                    Голосування активне
                  </p>
                  <p className="font-body text-success/80 mt-0.5 text-xs sm:text-sm">
                    Завершується {formatDateTime(election.closesAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-success text-2xl font-bold sm:text-3xl">
                    {election.ballotCount.toLocaleString('uk-UA')}
                  </p>
                  <p className="font-body text-success/70 text-xs">
                    {pluralize(election.ballotCount, ['бюлетень', 'бюлетені', 'бюлетенів'], false)}{' '}
                    подано
                  </p>
                </div>
              </div>
            )}

            {isClosed && results && (
              <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
                <div className="border-border-subtle flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
                    Результати голосування
                  </h2>
                  <Badge variant="secondary" size="md">
                    {pluralize(election.ballotCount, ['бюлетень', 'бюлетені', 'бюлетенів'])}
                  </Badge>
                </div>
                <div className="p-4 sm:p-6">
                  <ResultsChart
                    results={results}
                    totalBallots={election.ballotCount}
                    electionId={election.id}
                    hideOwnVote
                  />
                </div>
              </div>
            )}

            {!isClosed && (
              <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
                <div className="border-border-subtle border-b px-4 py-4 sm:px-6">
                  <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
                    Варіанти відповідей
                  </h2>
                </div>
                <div className="space-y-3 p-4 sm:p-6">
                  {election.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className="border-border-subtle bg-surface flex items-center gap-3 rounded-lg border p-3 sm:gap-4 sm:p-3.5"
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
            <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
              <div className="space-y-4 p-4 sm:p-5">
                <TimelineItem
                  label="Створено"
                  value={formatDateTime(election.createdAt)}
                  icon={<Plus className="h-4 w-4" />}
                  status="done"
                />
                <TimelineItem
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                  icon={<Play className="h-4 w-4" />}
                  status={election.status === 'upcoming' ? 'pending' : 'done'}
                />
                <TimelineItem
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                  icon={<StopCircle className="h-4 w-4" />}
                  status={isClosed ? 'done' : 'pending'}
                />
                {isDeleted && election.deletedAt && (
                  <TimelineItem
                    label="Видалено"
                    value={formatDateTime(election.deletedAt)}
                    icon={<RotateCcw className="h-4 w-4" />}
                    status="done"
                  />
                )}
              </div>
            </div>

            {election.restrictions.length > 0 && (
              <AccessRestrictions restrictions={election.restrictions} />
            )}

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
