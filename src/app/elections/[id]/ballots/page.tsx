import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getServerSession, serverFetch } from '@/lib/server-auth';
import { BallotsClient } from '@/components/elections/ballots-client';
import { Alert } from '@/components/ui/alert';
import type { BallotsResponse } from '@/types';

interface BallotsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: BallotsPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Бюлетені голосування #${id}` };
}

export default async function BallotsPage({ params, searchParams }: BallotsPageProps) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { data, error, status } = await serverFetch<BallotsResponse>(
    `/api/elections/${id}/ballots?page=${page}&pageSize=20`,
  );

  if (status === 404 || (!data && status !== 0)) notFound();

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Page header */}
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
        {/* Transparency explanation */}
        <Alert variant="info" title="Публічна перевірка" className="animate-fade-up">
          Кожен бюлетень є публічним та верифікованим. Знайдіть свій голос за хешем і переконайтеся,
          що він зафіксований коректно. Вміст зашифровано — ваш вибір залишається анонімним.
        </Alert>

        {error ? (
          <Alert variant="error" title="Помилка завантаження">
            {error}
          </Alert>
        ) : (
          <BallotsClient electionId={parseInt(id, 10)} initialData={data!} initialPage={page} />
        )}
      </div>
    </div>
  );
}
