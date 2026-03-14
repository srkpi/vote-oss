import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { BallotsClient } from '@/components/elections/ballots-client';
import { Alert } from '@/components/ui/alert';
import { serverFetch } from '@/lib/server-auth';
import type { BallotsResponse } from '@/types/ballot';
import type { ElectionDetail } from '@/types/election';

interface BallotsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BallotsPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Бюлетені голосування #${id}` };
}

export default async function BallotsPage({ params }: BallotsPageProps) {
  const { id } = await params;

  const [ballotsResult, electionResult] = await Promise.all([
    serverFetch<BallotsResponse>(`/api/elections/${id}/ballots`),
    serverFetch<ElectionDetail>(`/api/elections/${id}`),
  ]);

  const { data, error, status } = ballotsResult;
  const { data: election } = electionResult;

  if (status === 404) notFound();

  if (!data) {
    if (status === 403) {
      return (
        <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)] flex items-center justify-center p-4">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden w-full max-w-md">
            <ErrorState
              title="Доступ обмежено"
              description="У вас немає доступу до бюлетенів цього голосування"
            />
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] bg-[var(--surface)]">
      <PageHeader
        nav={[
          { label: 'Голосування', href: '/elections' },
          ...(data?.election ? [{ label: data.election.title, href: `/elections/${id}` }] : []),
          { label: 'Бюлетені' },
        ]}
        title="Публічні бюлетені"
      />

      <div className="container py-8 space-y-6">
        {error ? (
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        ) : (
          <BallotsClient initialData={data!} election={election ?? null} />
        )}
      </div>
    </div>
  );
}
