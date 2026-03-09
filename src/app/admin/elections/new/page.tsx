import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateElectionForm } from '@/components/admin/create-election-form';

export const metadata: Metadata = {
  title: 'Нове голосування',
};

export default function NewElectionPage() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-[var(--border-subtle)] px-4 sm:px-8 py-4 sm:py-6">
        <div className="animate-fade-up">
          <nav className="flex items-center gap-2 text-sm font-body text-[var(--muted-foreground)] mb-3 sm:mb-4">
            <Link href="/admin" className="hover:text-[var(--kpi-navy)] transition-colors">
              Адмін
            </Link>
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link
              href="/admin/elections"
              className="hover:text-[var(--kpi-navy)] transition-colors"
            >
              Голосування
            </Link>
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[var(--foreground)]">Нове</span>
          </nav>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            Нове голосування
          </h1>
          <p className="font-body text-sm text-[var(--muted-foreground)] mt-0.5">
            Налаштуйте параметри та варіанти голосування
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Info banner */}
          <div
            className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-[var(--radius-xl)] navy-gradient text-white animate-fade-up"
            style={{ animationFillMode: 'both' }}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-display text-sm sm:text-base font-semibold leading-tight">
                Налаштування безпеки
              </p>
              <p className="text-xs sm:text-sm text-white/80 font-body mt-1 leading-relaxed">
                Після створення автоматично генерується пара RSA-2048 ключів. Публічний ключ
                використовується для шифрування голосів, приватний — розкривається лише після
                закриття.
              </p>
            </div>
          </div>

          {/* Form card */}
          <div
            className="bg-white rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-[var(--shadow-card)] p-5 sm:p-8 animate-fade-up"
            style={{ animationDelay: '100ms', animationFillMode: 'both' }}
          >
            <CreateElectionForm />
          </div>
        </div>
      </div>
    </div>
  );
}
