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
              <FileText className="h-3.5 w-3.5" />
              Бюлетені
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/elections/${id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Публічна сторінка</span>
            </Link>
          </Button>
          {canDelete && <DeleteElectionButton electionId={id} electionTitle={election.title} />}
        </div>
      </PageHeader>

      <div className="p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {isOpen && (
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
                  <p className="font-body text-success/70 text-xs">бюлетенів подано</p>
                </div>
              </div>
            )}

            {isClosed && tally && (
              <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
                <div className="border-border-subtle flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
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
              <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
                <div className="border-border-subtle border-b px-4 py-4 sm:px-6">
                  <h2 className="font-display text-foreground text-base font-semibold sm:text-lg">
                    Варіанти відповідей
                  </h2>
                </div>
                <div className="space-y-3 p-4 sm:p-6">
                  {election.choices.map((choice, index) => (
                    <div
                      key={choice.id}
                      className="border-border-subtle bg-surface flex items-center gap-3 rounded-lg border p-3 sm:gap-4 sm:p-3.5"
                    >
                      <span className="navy-gradient font-body flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white sm:h-8 sm:w-8">
                        {String.fromCharCode(65 + index)}
                      </span>
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
              </div>
            </div>

            <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white">
              <div className="border-border-subtle border-b px-4 py-4 sm:px-5">
                <h3 className="font-display text-foreground text-base font-semibold">Доступ</h3>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="font-body text-muted-foreground text-sm">Підрозділ</span>
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
                  <span className="font-body text-muted-foreground text-sm">Група</span>
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
