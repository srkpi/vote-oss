import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { BallotsClient } from '@/components/elections/ballots-client';
import { Alert } from '@/components/ui/alert';
import { serverApi } from '@/lib/api/server';
import { isBotRequest } from '@/lib/utils/bot';

interface BallotsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BallotsPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data, status } = await serverApi.elections.og(id);

  let metaTitle = 'Бюлетені голосування';
  if (status === 404) {
    metaTitle = '404 | Голосування не здайдено';
  } else if (data?.title) {
    metaTitle = `Бюлетені | ${data.title}`;
  }

  return {
    title: metaTitle,
    description: metaTitle,
  };
}

export default async function BallotsPage({ params }: BallotsPageProps) {
  const { id } = await params;

  if (await isBotRequest()) return null;

  const { data, error, status } = await serverApi.elections.getBallots(id);

  if (status === 404) notFound();

  if (!data) {
    if (status === 403) {
      return (
        <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
          <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
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

  if (data.election.deletedAt) {
    return (
      <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-4">
        <div className="border-border-color shadow-shadow-sm w-full max-w-md overflow-hidden rounded-xl border bg-white">
          <ErrorState title="Голосування було видалено" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <PageHeader
        nav={[
          { label: 'Голосування', href: '/elections' },
          { label: data.election.title, href: `/elections/${id}` },
          { label: 'Бюлетені' },
        ]}
        title="Публічні бюлетені"
        isContainer
      />

      <div className="container space-y-6 py-8">
        {error ? (
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        ) : (
          <BallotsClient initialData={data} />
        )}
      </div>
    </div>
  );
}
