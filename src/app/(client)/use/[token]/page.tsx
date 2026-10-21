'use client';

import { CheckIcon, TriangleAlert } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';

type Status = 'loading' | 'success' | 'error';

export default function UseBypassTokenPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const calledRef = useRef(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  useEffect(() => {
    if (calledRef.current) {
      return;
    }
    calledRef.current = true;

    const apply = async () => {
      const result = await api.bypass.apply(token);

      if (result.success) {
        setStatus('success');
        const { type, electionId } = result.data as {
          type: 'GLOBAL' | 'ELECTION';
          electionId: string | null;
        };

        const target =
          type === 'ELECTION' && electionId ? `/elections/${electionId}` : '/elections';

        setRedirectTarget(target);

        setTimeout(() => {
          router.push(target);
          router.refresh();
        }, 1500);
      } else {
        setErrorMessage(result.error);
        setStatus('error');
      }
    };

    apply();
  }, [token, router]);

  return (
    <div className="flex min-h-[calc(100dvh-var(--header-height))] items-center justify-center p-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-kpi-navy/5 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-kpi-orange/8 blur-3xl" />
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

            <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
              {status === 'loading' && 'Активація доступу…'}
              {status === 'success' && 'Доступ активовано!'}
              {status === 'error' && 'Помилка активації'}
            </h1>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              {status === 'loading' && 'Застосовуємо ваш токен доступу'}
              {status === 'success' &&
                `Перенаправляємо вас ${redirectTarget === '/elections' ? 'до голосувань' : 'до голосування'}…`}
              {status === 'error' && (errorMessage ?? 'Не вдалося активувати токен доступу')}
            </p>

            {status === 'error' && (
              <Button
                size="lg"
                fullWidth
                onClick={() => router.push('/elections')}
                className="mt-8"
              >
                До голосувань
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
