'use client';

import { CheckIcon, TriangleAlert } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';

type Status = 'loading' | 'success' | 'error';

const STATUS_CONFIG = {
  loading: {
    title: 'Авторизація…',
    description: 'Перевіряємо вашу особу через KPI ID',
  },
  success: {
    title: 'Успішний вхід!',
    description: 'Перенаправляємо вас до платформи…',
  },
  error: {
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

      const result = await api.auth.loginWithTicket(ticketId);

      if (result.success) {
        setStatus('success');
        const redirectTo = result.data?.redirectTo ?? '/elections';
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 1200);
      } else {
        if (result.error === 'Not allowed auth method') {
          setErrorMessage('Авторизуйтесь через Bank ID чи застосунок Дія');
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-kpi-navy/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-kpi-orange/8 blur-3xl" />
        <div className="pattern-grid absolute inset-0 opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="border-border-color overflow-hidden rounded-2xl border bg-card shadow-xl">
          <div
            className={`h-1.5 w-full transition-all duration-700 ${
              status === 'loading'
                ? 'animate-[shimmer_2s_linear_infinite] bg-linear-to-r from-kpi-navy via-kpi-blue-light to-kpi-navy bg-size-[200%_100%]'
                : status === 'success'
                  ? 'bg-linear-to-r from-success to-emerald-400'
                  : 'bg-linear-to-r from-error to-rose-400'
            }`}
          />

          <div className="p-10 text-center">
            <div className="mb-6 flex justify-center">
              {status === 'loading' && (
                <div className="relative h-20 w-20">
                  <div className="border-border-color absolute inset-0 rounded-full border-4" />
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-kpi-navy border-t-transparent" />
                  <div
                    className="absolute inset-3 animate-spin rounded-full border-2 border-kpi-orange/30 border-b-accent"
                    style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
                  />
                </div>
              )}

              {status === 'success' && (
                <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full border-2 border-success/30 bg-success-bg">
                  <CheckIcon className="h-10 w-10 text-success" />
                </div>
              )}

              {status === 'error' && (
                <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full border-2 border-error/30 bg-error-bg">
                  <TriangleAlert className="h-10 w-10 text-error" />
                </div>
              )}
            </div>

            <h1 className="mb-2 font-display text-2xl font-bold text-foreground">{config.title}</h1>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              {status === 'error' && errorMessage ? errorMessage : config.description}
            </p>

            {status === 'error' && (
              <div className="mt-8 flex flex-col gap-3">
                <Button onClick={() => router.push('/login')} variant="default" size="lg">
                  Повернутися до входу
                </Button>
                <Button
                  onClick={() => {
                    setStatus('loading');
                    setErrorMessage(null);
                    calledRef.current = false;
                    window.location.reload();
                  }}
                  variant="outline"
                  size="lg"
                >
                  Спробувати знову
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
