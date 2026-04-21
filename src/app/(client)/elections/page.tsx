import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { SessionGuard } from '@/components/common/session-guard';
import { ElectionsFilter } from '@/components/elections/elections-filter';
import { Button } from '@/components/ui/button';
import { serverApi } from '@/lib/api/server';
import { APP_NAME, APP_URL } from '@/lib/config/client';
import { getServerSession } from '@/lib/server-auth';
import { isBotRequest } from '@/lib/utils/bot';
import { OPENGRAPH_IMAGE_DATA } from '@/lib/utils/metadata';

export const metadata: Metadata = {
  title: 'Голосування',
  description: 'Список всіх доступних голосувань',
  openGraph: {
    title: `Голосування | ${APP_NAME}`,
    description: 'Список всіх доступних голосувань',
    url: new URL('/elections', APP_URL),
    images: [OPENGRAPH_IMAGE_DATA],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Голосування | ${APP_NAME}`,
    description: 'Список всіх доступних голосувань',
    images: [OPENGRAPH_IMAGE_DATA],
  },
};

export default async function ElectionsPage() {
  if (await isBotRequest()) return null;

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { data, error } = await serverApi.elections.list();

  const elections = (data ?? []).filter((e) => !e.deletedAt);
  const counts = elections.reduce(
    (acc, e) => {
      if (e.status === 'open') acc.open++;
      else if (e.status === 'upcoming') acc.upcoming++;
      else if (e.status === 'closed') acc.closed++;
      return acc;
    },
    { open: 0, upcoming: 0, closed: 0 },
  );

  const { open, upcoming, closed } = counts;

  return (
    <div className="bg-surface min-h-[calc(100dvh-var(--header-height))]">
      <SessionGuard userId={session.userId} />
      <PageHeader
        title="Голосування"
        description="Усі доступні вам голосування в одному місці"
        isContainer
      >
        {session.isAdmin && (
          <Button variant="accent" size="sm" asChild>
            <Link href="/admin/elections/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Нове голосування</span>
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="container py-8">
        {error ? (
          <div className="border-border-color shadow-shadow-sm overflow-hidden rounded-xl border bg-white">
            <ErrorState title="Не вдалося завантажити голосування" description={error} />
          </div>
        ) : (
          <ElectionsFilter
            elections={elections ?? []}
            counts={{ open, upcoming, closed, total: (elections ?? []).length }}
          />
        )}
      </div>
    </div>
  );
}
