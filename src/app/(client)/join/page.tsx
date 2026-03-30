import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { JoinAdminForm } from '@/components/admin/join-admin-form';
import { getServerSession } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
  description: 'Використайте токен запрошення, щоб отримати права адміністратора.',
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

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
    <div className="bg-surface flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-kpi-navy/5 absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-kpi-orange/8 absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full blur-3xl" />
        <div className="pattern-grid absolute inset-0 opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="border-border-color shadow-shadow-xl overflow-hidden rounded-2xl border bg-white">
          {/* Top accent bar */}
          <div className="navy-gradient h-1.5 w-full" />

          {/* Card header */}
          <div className="border-border-subtle border-b px-8 pt-8 pb-6">
            <h1 className="font-display text-foreground mb-6 text-center text-2xl leading-tight font-bold">
              Приєднатися як адміністратор
            </h1>

            {/* User info banner */}
            <div className="border-border-subtle bg-surface flex items-center gap-3 rounded-lg border p-3.5">
              <div className="navy-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
                {session.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-foreground text-sm font-semibold wrap-break-word">
                  {session.fullName}
                </p>
                <p className="font-body text-muted-foreground text-xs">
                  {session.faculty} · {session.group}
                </p>
              </div>
              <div className="font-body border-success/20 bg-success-bg text-success hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs md:flex">
                <CheckCircle2 className="h-3 w-3" />
                Авторизовано
              </div>
            </div>
          </div>

          <div className="px-8 py-7">
            <JoinAdminForm initialToken={initialToken} />
          </div>
        </div>
      </div>
    </div>
  );
}
