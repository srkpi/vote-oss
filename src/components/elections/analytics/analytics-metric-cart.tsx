'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/common';
import type { MetricCardConfig, MetricScaleConfig } from '@/types/metrics';

const COLOR_GRADIENT: Record<
  MetricCardConfig['color'],
  { from: string; to: string; text: string }
> = {
  navy: { from: '#1c396e', to: '#1062a3', text: '#1c396e' },
  orange: { from: '#f07d00', to: '#ec6605', text: '#f07d00' },
  blue: { from: '#008acf', to: '#0d5690', text: '#008acf' },
  success: { from: '#16a34a', to: '#15803d', text: '#16a34a' },
  warning: { from: '#f07d00', to: '#d97706', text: '#d97706' },
  error: { from: '#dc2626', to: '#b91c1c', text: '#dc2626' },
  purple: { from: '#8b5cf6', to: '#7c3aed', text: '#8b5cf6' },
};

const COLOR_STYLES: Record<
  MetricCardConfig['color'],
  { border: string; iconBg: string; iconText: string }
> = {
  navy: { border: 'border-kpi-navy/15', iconBg: 'bg-kpi-navy/8', iconText: 'text-kpi-navy' },
  orange: {
    border: 'border-kpi-orange/15',
    iconBg: 'bg-kpi-orange/8',
    iconText: 'text-kpi-orange',
  },
  blue: {
    border: 'border-kpi-blue-light/15',
    iconBg: 'bg-kpi-blue-light/8',
    iconText: 'text-kpi-blue-light',
  },
  success: { border: 'border-success/15', iconBg: 'bg-success/8', iconText: 'text-success' },
  warning: { border: 'border-warning/15', iconBg: 'bg-warning/8', iconText: 'text-warning' },
  error: { border: 'border-error/15', iconBg: 'bg-error/8', iconText: 'text-error' },
  purple: { border: 'border-violet-400/20', iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
};

function MetricScale({ scale }: { scale: MetricScaleConfig }) {
  const { min, max, current, gradientFrom, gradientTo, labels } = scale;
  const pct = Math.max(2, Math.min(98, ((current - min) / (max - min)) * 100));

  return (
    <div className="space-y-2.5">
      <div
        className="relative h-3 w-full overflow-visible rounded-full"
        style={{ background: `linear-gradient(to right, ${gradientFrom}33, ${gradientTo}33)` }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
            opacity: 0.9,
          }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white shadow-md">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground text-[10px] font-medium">{labels[0]}</span>
        <span className="text-muted-foreground text-[10px] font-medium">{labels[1]}</span>
      </div>
    </div>
  );
}

function MetricDetailModal({ metric, onClose }: { metric: MetricCardConfig; onClose: () => void }) {
  const grad = COLOR_GRADIENT[metric.color];
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-black/55 backdrop-blur-sm"
        style={{ animationDuration: '180ms' }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full outline-none sm:max-w-lg',
          'shadow-shadow-xl animate-scale-in overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl',
        )}
        style={{ animationDuration: '200ms' }}
      >
        {/* Gradient header */}
        <div
          className="relative overflow-hidden px-6 pt-7 pb-6"
          style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/8" />

          <div className="relative mb-5 flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/25 text-white">
              {metric.icon}
            </div>
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-white/65 uppercase">
                Показник голосування
              </p>
              <h2 className="font-display mt-0.5 text-lg leading-tight font-bold text-white">
                {metric.label}
              </h2>
            </div>
          </div>

          <div className="relative">
            <div className="font-display text-5xl leading-none font-bold text-white tabular-nums">
              {metric.value}
            </div>
            <p className="font-body mt-2 max-w-xs text-sm leading-snug text-white/75">
              {metric.interpretation}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
          {metric.scale && (
            <div>
              <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
                Шкала значень
              </p>
              <MetricScale scale={metric.scale} />
            </div>
          )}
          {metric.scale && <div className="border-border-subtle border-t" />}

          <div>
            <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Що показує цей показник?
            </p>
            <p className="text-foreground font-body text-sm leading-relaxed">
              {metric.description}
            </p>
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: `${grad.text}10`, border: `1px solid ${grad.text}25` }}
          >
            <p
              className="mb-1.5 text-[10px] font-semibold tracking-wider uppercase"
              style={{ color: grad.text }}
            >
              В цьому голосуванні
            </p>
            <p className="font-body text-foreground text-sm leading-relaxed">{metric.insight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsMetricCard({
  metric,
  onOpen,
}: {
  metric: MetricCardConfig;
  onOpen: (m: MetricCardConfig) => void;
}) {
  const styles = COLOR_STYLES[metric.color];
  const grad = COLOR_GRADIENT[metric.color];

  return (
    <button
      onClick={() => onOpen(metric)}
      className={cn(
        'group w-full rounded-xl border bg-white p-5 text-left',
        'cursor-pointer transition-all duration-200',
        'shadow-shadow-sm hover:shadow-shadow-md hover:-translate-y-0.5',
        styles.border,
        'focus-visible:ring-kpi-blue-light focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', styles.iconBg)}>
          <span className={styles.iconText}>{metric.icon}</span>
        </div>
        <svg
          className="text-muted-foreground h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M3 13L13 3M13 3H7M13 3V9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        className="font-display mb-1.5 text-2xl leading-none font-bold tabular-nums"
        style={{ color: grad.text }}
      >
        {metric.value}
      </div>

      <p className="text-muted-foreground font-body mb-3 line-clamp-2 text-xs leading-snug">
        {metric.interpretation}
      </p>

      <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {metric.label}
      </p>

      {metric.scale && (
        <div className="border-border-subtle mt-3.5 border-t pt-3.5">
          <div className="bg-border-subtle relative h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(2, Math.min(98, ((metric.scale.current - metric.scale.min) / (metric.scale.max - metric.scale.min)) * 100))}%`,
                background: `linear-gradient(to right, ${metric.scale.gradientFrom}, ${metric.scale.gradientTo})`,
              }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

export function AnalyticsMetricsGrid({ metrics }: { metrics: MetricCardConfig[] }) {
  const [activeMetric, setActiveMetric] = useState<MetricCardConfig | null>(null);
  if (metrics.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <AnalyticsMetricCard key={m.id} metric={m} onOpen={setActiveMetric} />
        ))}
      </div>
      {activeMetric && (
        <MetricDetailModal metric={activeMetric} onClose={() => setActiveMetric(null)} />
      )}
    </>
  );
}
