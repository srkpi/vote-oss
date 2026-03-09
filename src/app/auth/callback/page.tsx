'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginWithTicket } from '@/lib/api-client';

type Status = 'loading' | 'success' | 'error';

const STATUS_CONFIG = {
  loading: {
    icon: null,
    title: 'Авторизація…',
    description: 'Перевіряємо вашу особу через КПІ ID',
  },
  success: {
    icon: 'check',
    title: 'Успішний вхід!',
    description: 'Перенаправляємо вас до платформи…',
  },
  error: {
    icon: 'error',
    title: 'Помилка авторизації',
    description: 'Не вдалось підтвердити особу. Спробуйте ще раз.',
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
    if (!ticketId || calledRef.current) {
      return;
    }

    calledRef.current = true;

    const run = async () => {
      const result = await loginWithTicket(ticketId);

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
    <div className="min-h-[calc(100vh-var(--header-height))] flex items-center justify-center p-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[var(--kpi-navy)]/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-[var(--kpi-orange)]/8 blur-3xl" />
        <div className="absolute inset-0 pattern-grid opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden">
          {/* Top accent */}
          <div
            className={`h-1.5 w-full transition-all duration-700 ${
              status === 'loading'
                ? 'bg-gradient-to-r from-[var(--kpi-navy)] via-[var(--kpi-blue-light)] to-[var(--kpi-navy)] bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]'
                : status === 'success'
                  ? 'bg-gradient-to-r from-[var(--success)] to-emerald-400'
                  : 'bg-gradient-to-r from-[var(--error)] to-rose-400'
            }`}
          />

          <div className="p-10 text-center">
            {/* Status icon */}
            <div className="flex justify-center mb-6">
              {status === 'loading' && (
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--border-color)]" />
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--kpi-navy)] border-t-transparent animate-spin" />
                  <div
                    className="absolute inset-3 rounded-full border-2 border-[var(--kpi-orange)]/30 border-b-[var(--kpi-orange)] animate-spin"
                    style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                  />
                </div>
              )}

              {status === 'success' && (
                <div className="w-20 h-20 rounded-full bg-[var(--success-bg)] border-2 border-[var(--success)]/30 flex items-center justify-center animate-scale-in">
                  <svg
                    className="w-10 h-10 text-[var(--success)]"
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
                <div className="w-20 h-20 rounded-full bg-[var(--error-bg)] border-2 border-[var(--error)]/30 flex items-center justify-center animate-scale-in">
                  <svg
                    className="w-10 h-10 text-[var(--error)]"
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
            <h1 className="font-display text-2xl font-bold text-[var(--foreground)] mb-2">
              {config.title}
            </h1>
            <p className="font-body text-[var(--muted-foreground)] text-sm leading-relaxed">
              {status === 'error' && errorMessage ? errorMessage : config.description}
            </p>

            {/* Progress steps */}
            {status === 'loading' && (
              <div className="mt-8 space-y-3">
                {['Отримання токена від КПІ ID', 'Верифікація особи', 'Створення сесії'].map(
                  (step, i) => (
                    <div key={step} className="flex items-center gap-3 text-left">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        <div
                          className={`w-2 h-2 rounded-full transition-all duration-500 ${
                            i === 0 ? 'bg-[var(--kpi-navy)] scale-125' : 'bg-[var(--border-color)]'
                          }`}
                          style={{ transitionDelay: `${i * 200}ms` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-body ${i === 0 ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}
                      >
                        {step}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Error action */}
            {status === 'error' && (
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => router.push('/auth/login')}
                  className="w-full h-10 px-4 rounded-[var(--radius)] bg-[var(--kpi-navy)] text-white text-sm font-medium font-body hover:bg-[var(--kpi-navy-hover)] transition-colors"
                >
                  Повернутися до входу
                </button>
                <button
                  onClick={() => {
                    calledRef.current = false;
                    setStatus('loading');
                    setErrorMessage(null);
                    window.location.reload();
                  }}
                  className="w-full h-10 px-4 rounded-[var(--radius)] bg-[var(--surface)] text-[var(--foreground)] text-sm font-medium font-body border border-[var(--border-color)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  Спробувати знову
                </button>
              </div>
            )}

            {/* Security note */}
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)] font-body">
                <svg
                  className="w-3.5 h-3.5 text-[var(--success)] shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Захищене з&apos;єднання · КПІ ім. Ігоря Сікорського</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
