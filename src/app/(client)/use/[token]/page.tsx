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
    if (calledRef.current) return;
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
        <div className="bg-kpi-navy/5 absolute top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-kpi-orange/8 absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="border-border-color shadow-shadow-xl overflow-hidden rounded-2xl border bg-white">
          <div
            className={`h-1.5 w-full transition-all duration-700 ${
              status === 'loading'
                ? 'from-kpi-navy via-kpi-blue-light to-kpi-navy animate-[shimmer_2s_linear_infinite] bg-linear-to-r bg-size-[200%_100%]'
                : status === 'success'
                  ? 'from-success bg-linear-to-r to-emerald-400'
                  : 'from-error bg-linear-to-r to-rose-400'
            }`}
          />

          <div className="p-10 text-center">
            <div className="mb-6 flex justify-center">
              {status === 'loading' && (
                <div className="relative h-20 w-20">
                  <div className="border-border-color absolute inset-0 rounded-full border-4" />
                  <div className="border-kpi-navy absolute inset-0 animate-spin rounded-full border-4 border-t-transparent" />
                </div>
              )}
              {status === 'success' && (
                <div className="animate-scale-in border-success/30 bg-success-bg flex h-20 w-20 items-center justify-center rounded-full border-2">
                  <CheckIcon className="text-success h-10 w-10" />
                </div>
              )}
              {status === 'error' && (
                <div className="animate-scale-in border-error/30 bg-error-bg flex h-20 w-20 items-center justify-center rounded-full border-2">
                  <TriangleAlert className="text-error h-10 w-10" />
                </div>
              )}
            </div>

            <h1 className="font-display text-foreground mb-2 text-2xl font-bold">
              {status === 'loading' && 'Активація доступу…'}
              {status === 'success' && 'Доступ активовано!'}
              {status === 'error' && 'Помилка активації'}
            </h1>
            <p className="font-body text-muted-foreground text-sm leading-relaxed">
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
