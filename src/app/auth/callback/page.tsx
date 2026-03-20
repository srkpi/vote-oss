'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api/browser';

type Status = 'loading' | 'success' | 'error';

const STATUS_CONFIG = {
  loading: {
    icon: null,
    title: 'Авторизація…',
    description: 'Перевіряємо вашу особу через KPI ID',
  },
  success: {
    icon: 'check',
    title: 'Успішний вхід!',
    description: 'Перенаправляємо вас до платформи…',
  },
  error: {
    icon: 'error',
    title: 'Помилка авторизації',
    description: 'Не вдалось підтвердити особу',
  },
} as const;

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const calledRef = useRef(false);

  const ticketId = searchParams.get('ticketId');

  useEffect(() => {
    if (calledRef.current) {
      return;
    }

    calledRef.current = true;

    const run = async () => {
      if (!ticketId) {
        setErrorMessage('Відсутній ticketId');
        setStatus('error');
        return;
      }

      const result = await api.loginWithTicket(ticketId);

      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          router.push('/elections');
          router.refresh();
        }, 1200);
      } else {
        setErrorMessage(result.error);
        setStatus('error');
      }
    };

    run();
  }, [ticketId, router]);

  const config = STATUS_CONFIG[status];

  return (
    <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-(--kpi-navy)/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-(--kpi-orange)/8 blur-3xl" />
        <div className="pattern-grid absolute inset-0 opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-(--border-color) bg-white shadow-(--shadow-xl)">
          {/* Top accent */}
          <div
            className={`h-1.5 w-full transition-all duration-700 ${
              status === 'loading'
                ? 'animate-[shimmer_2s_linear_infinite] bg-linear-to-r from-(--kpi-navy) via-(--kpi-blue-light) to-(--kpi-navy) bg-size-[200%_100%]'
                : status === 'success'
                  ? 'bg-linear-to-r from-(--success) to-emerald-400'
                  : 'bg-linear-to-r from-(--error) to-rose-400'
            }`}
          />

          <div className="p-10 text-center">
            {/* Status icon */}
            <div className="mb-6 flex justify-center">
              {status === 'loading' && (
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-4 border-(--border-color)" />
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-(--kpi-navy) border-t-transparent" />
                  <div
                    className="absolute inset-3 animate-spin rounded-full border-2 border-(--kpi-orange)/30 border-b-(--kpi-orange)"
                    style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                  />
                </div>
              )}

              {status === 'success' && (
                <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full border-2 border-(--success)/30 bg-(--success-bg)">
                  <svg
                    className="h-10 w-10 text-(--success)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {status === 'error' && (
                <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full border-2 border-(--error)/30 bg-(--error-bg)">
                  <svg
                    className="h-10 w-10 text-(--error)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Text */}
            <h1 className="font-display mb-2 text-2xl font-bold text-(--foreground)">
              {config.title}
            </h1>
            <p className="font-body text-sm leading-relaxed text-(--muted-foreground)">
              {status === 'error' && errorMessage ? errorMessage : config.description}
            </p>

            {/* Error action */}
            {status === 'error' && (
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => router.push('/auth/login')}
                  className="font-body h-10 w-full rounded-(--radius) bg-(--kpi-navy) px-4 text-sm font-medium text-white transition-colors hover:bg-(--kpi-navy-hover)"
                >
                  Повернутися до входу
                </button>
                <button
                  onClick={() => {
                    setStatus('loading');
                    setErrorMessage(null);
                    calledRef.current = false;
                    window.location.reload();
                  }}
                  className="font-body h-10 w-full rounded-(--radius) border border-(--border-color) bg-(--surface) px-4 text-sm font-medium text-(--foreground) transition-colors hover:bg-(--surface-hover)"
                >
                  Спробувати знову
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
