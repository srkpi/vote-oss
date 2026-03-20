import { ExternalLink, FileText, Play, Plus, StopCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DeleteElectionButton } from '@/components/admin/delete-election-button';
import { PageHeader } from '@/components/common/page-header';
import { EncryptionKey } from '@/components/elections/encryption-key';
import { ResultsChart } from '@/components/elections/result-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimelineItem } from '@/components/ui/timeline-item';
import { serverApi } from '@/lib/api/server';
import { getServerSession } from '@/lib/server-auth';
import { formatDateTime } from '@/lib/utils';
import type { TallyResponse } from '@/types/tally';

interface AdminElectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminElectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data } = await serverApi.getElection(id);
  return { title: data?.title ? `${data.title} — Деталі` : 'Деталі голосування' };
}

export default async function AdminElectionDetailPage({ params }: AdminElectionPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect('/auth/login');
  }

  const { id } = await params;

  const { data: election, status } = await serverApi.getElection(id);

  if (status === 404 || !election) notFound();

  const canDelete =
    !session.restrictedToFaculty || election.restrictedToFaculty === session.faculty;

  const isClosed = election.status === 'closed';
  const isOpen = election.status === 'open';

  let tally: TallyResponse | null = null;
  if (isClosed) {
    const { data } = await serverApi.getTally(id);
    tally = data;
  }

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
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/elections/${id}/ballots`}>
              <FileText className="w-3.5 h-3.5" />
              Бюлетені
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/elections/${id}`}>
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Публічна сторінка</span>
            </Link>
          </Button>
          {canDelete && <DeleteElectionButton electionId={id} electionTitle={election.title} />}
        </div>
      </PageHeader>

      <div className="p-4 sm:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {isOpen && (
              <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-[var(--radius-xl)] bg-[var(--success-bg)] border border-[var(--success)]/20">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--success)] flex items-center justify-center shrink-0">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm sm:text-base font-semibold text-[var(--success)]">
                    Голосування активне
                  </p>
                  <p className="text-xs sm:text-sm font-body text-[var(--success)]/80 mt-0.5">
                    Завершується {formatDateTime(election.closesAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl sm:text-3xl font-bold text-[var(--success)]">
                    {election.ballotCount.toLocaleString('uk-UA')}
                  </p>
                  <p className="text-xs font-body text-[var(--success)]/70">бюлетенів подано</p>
                </div>
              </div>
            )}

            {isClosed && tally && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                    Результати голосування
                  </h2>
                  <Badge variant="secondary" size="md">
                    {tally.totalBallots} бюлетенів
                  </Badge>
                </div>
                <div className="p-4 sm:p-6">
                  <ResultsChart results={tally.results} totalBallots={tally.totalBallots} />
                </div>
              </div>
            )}

            {!isClosed && (
              <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)]">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-[var(--foreground)]">
                    Варіанти відповідей
                  </h2>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
                  {election.choices.map((choice, index) => (
                    <div
                      key={choice.id}
                      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]"
                    >
                      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg navy-gradient flex items-center justify-center text-white text-xs font-bold font-body shrink-0">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 text-sm font-body text-[var(--foreground)] min-w-0 break-words">
                        {choice.choice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                <TimelineItem
                  label="Створено"
                  value={formatDateTime(election.createdAt)}
                  icon={<Plus className="w-4 h-4" />}
                  status="done"
                />
                <TimelineItem
                  label="Початок"
                  value={formatDateTime(election.opensAt)}
                  icon={<Play className="w-4 h-4" />}
                  status={election.status === 'upcoming' ? 'pending' : 'done'}
                />
                <TimelineItem
                  label="Завершення"
                  value={formatDateTime(election.closesAt)}
                  icon={<StopCircle className="w-4 h-4" />}
                  status={isClosed ? 'done' : 'pending'}
                />
              </div>
            </div>

            <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-display text-base font-semibold text-[var(--foreground)]">
                  Доступ
                </h3>
              </div>
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-[var(--muted-foreground)]">
                    Підрозділ
                  </span>
                  {election.restrictedToFaculty ? (
                    <Badge variant="info" size="md">
                      {election.restrictedToFaculty}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md">
                      Всі
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-[var(--muted-foreground)]">Група</span>
                  {election.restrictedToGroup ? (
                    <Badge variant="secondary" size="md">
                      {election.restrictedToGroup}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md">
                      Всі
                    </Badge>
                  )}
                </div>
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
