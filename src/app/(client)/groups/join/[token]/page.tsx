'use client';

import { CheckIcon, TriangleAlert } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';

type Status = 'loading' | 'success' | 'error';

export default function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const calledRef = useRef(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (calledRef.current) {
      return;
    }
    calledRef.current = true;

    const join = async () => {
      const result = await api.groups.join(decodeURIComponent(token));
      if (result.success) {
        setGroupName(result.data.groupName);
        setGroupId(result.data.groupId);
        setStatus('success');
        setTimeout(() => {
          router.push(`/groups/${result.data.groupId}`);
        }, 1800);
      } else {
        setErrorMessage(result.error);
        setStatus('error');
      }
    };

    join();
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
              {status === 'loading' && 'Приєднання до групи…'}
              {status === 'success' && `Ви в групі «${groupName}»!`}
              {status === 'error' && 'Помилка приєднання'}
            </h1>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">
              {status === 'loading' && 'Перевіряємо запрошення…'}
              {status === 'success' && 'Перенаправляємо вас до сторінки групи…'}
              {status === 'error' && (errorMessage ?? 'Не вдалося приєднатися до групи')}
            </p>

            {status === 'error' && (
              <Button size="lg" fullWidth onClick={() => router.push('/groups')} className="mt-8">
                До моїх груп
              </Button>
            )}

            {status === 'success' && groupId && (
              <Button
                size="lg"
                variant="secondary"
                fullWidth
                onClick={() => router.push(`/groups/${groupId}`)}
                className="mt-8"
              >
                Перейти до групи
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
