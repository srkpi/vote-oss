'use client';

import { formatDateTime } from '@/lib/utils/common';
import type { ElectionChoice } from '@/types/election';

export function LineTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) {
    return null;
  }
  const entries = payload as { dataKey: string; value: number; color: string }[];

  return (
    <div className="border-border-color min-w-36 rounded-xl border bg-card p-3.5 shadow-lg">
      <p className="font-body mb-2.5 text-xs font-semibold text-muted-foreground">
        {formatDateTime(label as number)}
      </p>
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
          if (!choice && entry.dataKey !== 'total') {
            return null;
          }
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="max-w-32 truncate text-xs text-muted-foreground">
                {choice?.choice ?? 'Всього'}
              </span>
              <span className="ml-auto font-display text-xs font-bold text-foreground tabular-nums">
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) {
    return null;
  }
  const count = (payload as { value: number }[])[0]?.value ?? 0;

  return (
    <div className="border-border-color rounded-xl border bg-card p-3.5 shadow-lg">
      <p className="font-body mb-1 text-xs font-semibold text-muted-foreground">
        {formatDateTime(label as number)}
      </p>
      <p className="font-display text-2xl leading-none font-bold text-kpi-navy">{count}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {count === 1 ? 'голос' : count < 5 ? 'голоси' : 'голосів'}
      </p>
    </div>
  );
}

export function ShareTooltip({ active, payload, label, choices }: Record<string, unknown>) {
  if (!active || !(payload as unknown[])?.length) {
    return null;
  }
  const entries = (payload as { dataKey: string; value: number; color: string }[])
    .slice()
    .reverse();

  return (
    <div className="border-border-color min-w-40 rounded-xl border bg-card p-3.5 shadow-lg">
      <p className="font-body mb-2.5 text-xs font-semibold text-muted-foreground">
        {formatDateTime(label as number)}
      </p>
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const choice = (choices as ElectionChoice[]).find((c) => c.id === entry.dataKey);
          if (!choice) {
            return null;
          }
          return (
            <div key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="max-w-28 truncate text-xs text-muted-foreground">
                {choice.choice}
              </span>
              <span className="ml-auto font-display text-xs font-bold text-foreground tabular-nums">
                {(entry.value as number).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
