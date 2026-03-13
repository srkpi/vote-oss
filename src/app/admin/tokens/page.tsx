// src/app/admin/tokens/page.tsx
import { ChevronRight, Key } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { TokensPageClient } from '@/components/admin/tokens-page-client';
import { getCurrentAdmin } from '@/lib/current-admin';
import { serverFetch } from '@/lib/server-auth';
import type { InviteToken } from '@/types/admin';

export const metadata: Metadata = {
  title: 'Токени запрошення',
};

export default async function TokensPage() {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin?.manage_admins) {
    redirect('/admin');
  }

  const { data: tokens, error } = await serverFetch<InviteToken[]>('/api/admins/invite');

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-2 sm:mb-3">
              <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
                Адмін
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[var(--foreground)]">Токени запрошення</span>
            </nav>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              Токени запрошення
            </h1>
            <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
              Керування посиланнями для запрошення нових адміністраторів
            </p>
          </div>
          <div className="shrink-0" id="tokens-header-actions" />
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6">
        <div className="flex items-start gap-3 p-4 rounded-[var(--radius-xl)] bg-[var(--info-bg)] border border-[var(--kpi-blue-light)]/20">
          <div className="w-8 h-8 rounded-lg bg-[var(--kpi-blue-light)] flex items-center justify-center shrink-0 mt-0.5">
            <Key className="w-4 h-4 text-white" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold font-body text-[var(--foreground)]">
              Як працюють токени
            </p>
            <p className="text-sm font-body text-[var(--muted-foreground)] leading-relaxed">
              Кожен токен — це одноразове або обмежене посилання запрошення. Передайте його
              майбутньому адміністратору або поділіться прямим посиланням. Токен автоматично
              видаляється після вичерпання ліміту використань або закінчення терміну дії.
            </p>
          </div>
        </div>

        <TokensPageClient
          initialTokens={tokens ?? []}
          canGrantManageAdmins={currentAdmin.manage_admins}
          restrictedToFaculty={currentAdmin.restricted_to_faculty}
          error={error}
        />
      </div>
    </div>
  );
}
