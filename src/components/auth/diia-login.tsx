'use client';

import { CheckIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { memo, useEffect, useEffectEvent, useRef, useState } from 'react';

import { DiiaLoginButton } from '@/components/auth/diia-login-button';
import { api } from '@/lib/api/browser';
import { DIIA_LINK_TTL_MS, DIIA_POLL_INTERVAL_MS } from '@/lib/constants';
import { cn } from '@/lib/utils/common';
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
        if (barRef.current) {
          barRef.current.style.backgroundColor = hexColor;
        }
        if (textRef.current) {
          textRef.current.style.color = hexColor;
        }
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
        <span className="font-body text-xs text-muted-foreground">Час дії</span>
        <span
          ref={textRef}
          className="font-body text-xs font-medium tabular-nums transition-colors duration-300"
        />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
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

  const stopPoll = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPolling = () => {
    stopPoll();
    pollTimerRef.current = setInterval(async () => {
      const requestId = requestIdRef.current;
      if (!requestId) {
        return;
      }

      try {
        const res = await api.auth.diiaCheck(requestId);
        if (!res.success) {
          return;
        }

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
  };

  const startFlow = async () => {
    if (startingRef.current) {
      return;
    }
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
  };

  const startAutoFlow = useEffectEvent(startFlow);

  useEffect(
    () => () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    },
    [],
  );
  useEffect(() => {
    if (shouldAutoStart && phase === 'idle') {
      // oxlint-disable-next-line react/set-state-in-effect
      startAutoFlow();
    }
  }, [shouldAutoStart, phase]);

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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <span className="text-sm text-muted-foreground">Завантаження…</span>
      </div>
    );
  }

  if (phase === 'waiting' && initData) {
    return (
      <div className={cn('space-y-4', fullWidth && 'w-full', className)}>
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          Відскануйте QR-код у застосунку Дія
        </p>

        <a
          href={initData.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mx-auto block w-fit overflow-hidden rounded transition-colors',
            'border-2 border-border hover:border-kpi-blue-light/50',
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
        <div className="animate-scale-in flex h-14 w-14 items-center justify-center rounded-full border border-success/30 bg-success-bg">
          <CheckIcon className="h-7 w-7 text-success" />
        </div>
        <p className="font-semibold text-foreground">Авторизація успішна!</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', fullWidth && 'w-full', className)}>
      <div className="rounded-lg border border-error/20 bg-error-bg p-3 text-center text-sm text-error">
        {errorMsg ?? 'Щось пішло не так.'}
      </div>
      <button
        onClick={startFlow}
        className="h-10 w-full rounded border text-sm font-medium hover:bg-surface"
      >
        Спробувати знову
      </button>
    </div>
  );
}
