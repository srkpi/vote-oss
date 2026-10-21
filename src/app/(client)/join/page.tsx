import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { JoinAdminForm } from '@/components/admin/join-admin-form';
import { SelfAvatar } from '@/components/ui/self-avatar';
import { getServerSession } from '@/lib/server-auth';
import type { User } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Приєднатися як адміністратор',
  description: 'Використайте токен запрошення, щоб отримати права адміністратора',
  robots: { index: false, follow: false },
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
  session: User;
  initialToken?: string;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center bg-surface p-6">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-kpi-navy/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-kpi-orange/8 blur-3xl" />
        <div className="pattern-grid absolute inset-0 opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="border-border-color overflow-hidden rounded-2xl border bg-card shadow-xl">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-kpi-navy" />

          {/* Card header */}
          <div className="border-b border-border-subtle px-8 pt-8 pb-6">
            <h1 className="mb-6 text-center font-display text-2xl leading-tight font-bold text-foreground">
              Приєднатися як адміністратор
            </h1>

            {/* User info banner */}
            <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3.5">
              <SelfAvatar userId={session.userId} fullName={session.fullName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-semibold wrap-break-word text-foreground">
                  {session.fullName}
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  {session.faculty} · {session.group}
                </p>
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
