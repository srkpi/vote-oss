'use client';

import { CheckIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { DiiaLoginButton } from '@/components/auth/diia-login-button';
import { api } from '@/lib/api/browser';
import { DIIA_LINK_TTL_MS, DIIA_POLL_INTERVAL_MS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DiiaInitResponse } from '@/types/auth';

interface TimerDisplayProps {
  expiresAt: number;
  onExpire: () => void;
}

const TimerDisplay = memo(({ expiresAt, onExpire }: TimerDisplayProps) => {
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const onExpireRef = useRef(onExpire);
  const currentColorRef = useRef<'success' | 'orange' | 'error' | null>(null);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let frameId: number;

    const update = () => {
      const now = Date.now();
      const timeLeft = Math.max(0, expiresAt - now);
      const progressPercent = (timeLeft / DIIA_LINK_TTL_MS) * 100;
      const progressScale = Math.max(0, Math.min(1, progressPercent / 100));

      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progressScale})`;
      }

      let newColor: 'success' | 'orange' | 'error';
      let hexColor: string;

      if (progressPercent > 50) {
        newColor = 'success';
        hexColor = '#22c55e';
      } else if (progressPercent > 20) {
        newColor = 'orange';
        hexColor = '#f97316';
      } else {
        newColor = 'error';
        hexColor = '#ef4444';
      }

      if (currentColorRef.current !== newColor) {
        currentColorRef.current = newColor;
        if (barRef.current) barRef.current.style.backgroundColor = hexColor;
        if (textRef.current) textRef.current.style.color = hexColor;
      }

      if (textRef.current) {
        const totalSecs = Math.ceil(timeLeft / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (textRef.current.textContent !== timeStr) {
          textRef.current.textContent = timeStr;
        }
      }

      if (timeLeft <= 0) {
        onExpireRef.current();
        return;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [expiresAt]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-body text-muted-foreground text-xs">Час дії</span>
        <span
          ref={textRef}
          className="font-body text-xs font-medium tabular-nums transition-colors duration-300"
        />
      </div>
      <div className="bg-border-subtle h-1.5 w-full overflow-hidden rounded-full">
        <div
          ref={barRef}
          className="h-full w-full rounded-full transition-colors duration-300"
          style={{
            transformOrigin: 'left',
            transform: 'scaleX(1)',
            willChange: 'transform',
          }}
        />
      </div>
    </div>
  );
});

TimerDisplay.displayName = 'TimerDisplay';

type Phase = 'idle' | 'loading' | 'waiting' | 'success' | 'error';

interface DiiaLoginProps {
  fullWidth?: boolean;
  className?: string;
}

export function DiiaLogin({ fullWidth = false, className }: DiiaLoginProps) {
  const searchParams = useSearchParams();
  const shouldAutoStart = searchParams.get('auto') === 'true';

  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [initData, setInitData] = useState<DiiaInitResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPoll();
    pollTimerRef.current = setInterval(async () => {
      const requestId = requestIdRef.current;
      if (!requestId) return;

      try {
        const res = await api.auth.diiaCheck(requestId);
        if (!res.success) return;

        if (res.data.status === 'success') {
          stopPoll();
          setPhase('success');
          setTimeout(() => {
            router.push('/elections');
            router.refresh();
          }, 1200);
        }
      } catch {
        /* network silent retry */
      }
    }, DIIA_POLL_INTERVAL_MS);
  }, [stopPoll, router]);

  const startFlow = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    stopPoll();
    setPhase('loading');
    setErrorMsg(null);

    try {
      const res = await api.auth.diiaInit();
      if (!res.success) {
        throw new Error(res.error);
      }

      requestIdRef.current = res.data.requestId;
      setInitData(res.data);
      setPhase('waiting');
      startPolling();
    } catch (err) {
      console.error('[DiiaLogin] Error:', err);
      setPhase('error');
      setErrorMsg('Не вдалось отримати QR-код.');
    } finally {
      startingRef.current = false;
    }
  }, [stopPoll, startPolling]);

  useEffect(() => () => stopPoll(), [stopPoll]);
  useEffect(() => {
    if (shouldAutoStart && phase === 'idle') {
      startFlow();
    }
  }, [shouldAutoStart, phase, startFlow]);

  if (phase === 'idle') {
    return <DiiaLoginButton onClick={startFlow} fullWidth />;
  }

  if (phase === 'loading') {
    return (
      <div
        className={cn(
          'flex h-12 items-center justify-center gap-2.5',
          fullWidth && 'w-full',
          className,
        )}
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
        <span className="text-muted-foreground text-sm">Завантаження…</span>
      </div>
    );
  }

  if (phase === 'waiting' && initData) {
    return (
      <div className={cn('space-y-4', fullWidth && 'w-full', className)}>
        <p className="text-muted-foreground text-center text-sm leading-relaxed">
          Відскануйте QR-код у застосунку Дія
        </p>

        <a
          href={initData.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mx-auto block w-fit overflow-hidden rounded transition-colors',
            'border-2 border-black/10 hover:border-black/30',
            'lg:pointer-events-none lg:border-none lg:hover:border-none',
          )}
        >
          <Image src={initData.qrCode} alt="QR-код" width={220} height={220} priority />
        </a>

        <TimerDisplay expiresAt={new Date(initData.expiresAt).getTime()} onExpire={startFlow} />
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div
        className={cn('flex flex-col items-center gap-3 py-4', fullWidth && 'w-full', className)}
      >
        <div className="animate-scale-in bg-success-bg border-success/30 flex h-14 w-14 items-center justify-center rounded-full border">
          <CheckIcon className="text-success h-7 w-7" />
        </div>
        <p className="text-foreground font-semibold">Авторизація успішна!</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', fullWidth && 'w-full', className)}>
      <div className="border-error/20 bg-error-bg text-error rounded-lg border p-3 text-center text-sm">
        {errorMsg ?? 'Щось пішло не так.'}
      </div>
      <button
        onClick={startFlow}
        className="h-10 w-full rounded border text-sm font-medium hover:bg-neutral-50"
      >
        Спробувати знову
      </button>
    </div>
  );
}
