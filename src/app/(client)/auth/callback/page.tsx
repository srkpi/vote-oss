'use client';

import { CheckIcon, Smartphone, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { DiiaLoginButton } from '@/components/auth/diia-login-button';
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
  const [isDiiaError, setIsDiiaError] = useState(false);
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
        if (result.error === 'Authorization must be done through DIIA') {
          // User authenticated with KPI ID but not via Diia — guide them.
          setIsDiiaError(true);
          setErrorMessage(
            'Для верифікації, що голосує справжній студент, необхідно авторизуватись через застосунок Дія',
          );
        } else if (result.error === 'Platform is only available for students') {
          setErrorMessage('Платформа доступна лише студентам');
        } else if (result.error === 'Invalid or expired ticketId') {
          setErrorMessage('Не валідний або прострочений ticketId');
        } else {
          setErrorMessage(result.error);
        }
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
        <div className="bg-kpi-navy/5 absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-kpi-orange/8 absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full blur-3xl" />
        <div className="pattern-grid absolute inset-0 opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="border-border-color shadow-shadow-xl overflow-hidden rounded-2xl border bg-white">
          {/* Top accent bar */}
          <div
            className={`h-1.5 w-full transition-all duration-700 ${
              status === 'loading'
                ? 'from-kpi-navy via-kpi-blue-light to-kpi-navy animate-[shimmer_2s_linear_infinite] bg-linear-to-r bg-size-[200%_100%]'
                : status === 'success'
                  ? 'from-success bg-linear-to-r to-emerald-400'
                  : isDiiaError
                    ? 'bg-linear-to-r from-black to-neutral-600'
                    : 'from-error bg-linear-to-r to-rose-400'
            }`}
          />

          <div className="p-10 text-center">
            {/* Status icon */}
            <div className="mb-6 flex justify-center">
              {status === 'loading' && (
                <div className="relative h-20 w-20">
                  <div className="border-border-color absolute inset-0 rounded-full border-4" />
                  <div className="border-kpi-navy absolute inset-0 animate-spin rounded-full border-4 border-t-transparent" />
                  <div
                    className="border-kpi-orange/30 border-b-accent absolute inset-3 animate-spin rounded-full border-2"
                    style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                  />
                </div>
              )}

              {status === 'success' && (
                <div className="animate-scale-in border-success/30 bg-success-bg flex h-20 w-20 items-center justify-center rounded-full border-2">
                  <CheckIcon className="text-success h-10 w-10" />
                </div>
              )}

              {status === 'error' && (
                <>
                  {isDiiaError ? (
                    <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full border-2 border-black/20 bg-black/5">
                      <Smartphone className="h-10 w-10" />
                    </div>
                  ) : (
                    <div className="animate-scale-in border-error/30 bg-error-bg flex h-20 w-20 items-center justify-center rounded-full border-2">
                      <TriangleAlert className="text-error h-10 w-10" />
                    </div>
                  )}
                </>
              )}
            </div>

            <h1 className="font-display text-foreground mb-2 text-2xl font-bold">
              {isDiiaError ? 'Авторизуйтесь через Дію' : config.title}
            </h1>
            <p className="font-body text-muted-foreground text-sm leading-relaxed">
              {status === 'error' && errorMessage ? errorMessage : config.description}
            </p>

            {status === 'error' && (
              <div className="mt-8 flex flex-col gap-3">
                {isDiiaError ? (
                  <DiiaLoginButton onClick={() => router.push('/login?auto=true')} fullWidth />
                ) : (
                  <>
                    <button
                      onClick={() => router.push('/login')}
                      className="font-body bg-kpi-navy hover:bg-kpi-navy-hover h-10 w-full rounded-(--radius) px-4 text-sm font-medium text-white transition-colors"
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
                      className="font-body border-border-color bg-surface text-foreground hover:bg-surface-hover h-10 w-full rounded-(--radius) border px-4 text-sm font-medium transition-colors"
                    >
                      Спробувати знову
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
