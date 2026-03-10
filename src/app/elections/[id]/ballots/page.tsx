import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { serverFetch } from '@/lib/server-auth';
import { BallotsClient } from '@/components/elections/ballots-client';
import { Alert } from '@/components/ui/alert';
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

  if (status === 404 || (!data && status !== 0)) notFound();

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <div className="bg-white border-b border-[var(--border-subtle)]">
        <div className="container py-6">
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-4 animate-fade-down">
            <Link href="/elections" className="hover:text-[var(--kpi-navy)] transition-colors">
              Голосування
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            {data?.election && (
              <>
                <Link
                  href={`/elections/${id}`}
                  className="hover:text-[var(--kpi-navy)] transition-colors truncate max-w-xs"
                >
                  {data.election.title}
                </Link>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-[var(--foreground)]">Бюлетені</span>
          </nav>

          <div className="animate-fade-up">
            <h1 className="font-display text-3xl font-bold text-[var(--foreground)] leading-tight">
              Публічні бюлетені
            </h1>
            {data?.election && (
              <p className="text-[var(--muted-foreground)] font-body mt-1">{data.election.title}</p>
            )}
          </div>
        </div>
      </div>

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
