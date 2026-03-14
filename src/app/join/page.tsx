import { CheckCircle2, ChevronLeft, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { JoinAdminForm } from '@/components/admin/join-admin-form';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
  description: 'Використайте токен запрошення, щоб отримати права адміністратора КПІ Голос.',
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const session = (await getServerSession())!;
  const { token } = await searchParams;

  return <JoinPageContent session={session} initialToken={token} />;
}

export function JoinPageContent({
  session,
  initialToken,
}: {
  session: { fullName: string; faculty: string; group: string };
  initialToken?: string;
}) {
  return (
    <div className="min-h-[calc(100dvh-var(--header-height))] flex items-center justify-center p-6 bg-[var(--surface)]">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--kpi-navy)]/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-[var(--kpi-orange)]/8 blur-3xl" />
        <div className="absolute inset-0 pattern-grid opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Back link */}
        <Link
          href="/elections"
          className="inline-flex items-center gap-1.5 text-sm font-body text-[var(--muted-foreground)] hover:text-[var(--kpi-navy)] transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад до голосувань
        </Link>

        {/* Main card */}
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full navy-gradient" />

          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl navy-gradient flex items-center justify-center shadow-[var(--shadow-md)]">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-[var(--foreground)] leading-tight">
                  Приєднатися як адміністратор
                </h1>
                <p className="text-sm font-body text-[var(--muted-foreground)] mt-0.5">
                  КПІ Голос · Система голосування
                </p>
              </div>
            </div>

            {/* User info banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-full navy-gradient flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {session.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold font-body text-[var(--foreground)] truncate">
                  {session.fullName}
                </p>
                <p className="text-xs font-body text-[var(--muted-foreground)]">
                  {session.faculty} · {session.group}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-body text-[var(--success)] bg-[var(--success-bg)] px-2 py-1 rounded-full border border-[var(--success)]/20 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Авторизовано
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <JoinAdminForm initialToken={initialToken} />
          </div>
        </div>
      </div>
    </div>
  );
}
