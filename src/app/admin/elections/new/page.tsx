import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CreateElectionForm } from '@/components/admin/create-election-form';
import { getCurrentAdmin } from '@/lib/current-admin';

export const metadata: Metadata = {
  title: 'Нове голосування',
};

export default async function NewElectionPage() {
  const currentAdmin = await getCurrentAdmin();

  const restrictedToFaculty = currentAdmin?.restricted_to_faculty ?? false;
  const adminFaculty = currentAdmin?.faculty ?? '';

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-3 sm:mb-4">
          <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
            Адмін
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link href="/admin/elections" className="hover:text-[var(--kpi-navy)] transition-colors">
            Голосування
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[var(--foreground)]">Нове</span>
        </nav>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
          Нове голосування
        </h1>
        <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
          Налаштуйте параметри та варіанти голосування
        </p>
      </div>

      <div className="p-4 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-5 sm:p-8">
            <CreateElectionForm restrictedToFaculty={restrictedToFaculty ? adminFaculty : null} />
          </div>
        </div>
      </div>
    </div>
  );
}
