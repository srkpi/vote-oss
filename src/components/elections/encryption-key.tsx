import { Unlock } from 'lucide-react';

import { CopyButton } from '@/components/ui/copy-button';

interface EncryptionKeyProps {
  title: string;
  description: string;
  keyValue: string;
  isPrivate?: boolean;
}

export function EncryptionKey({
  title,
  keyValue,
  description,
  isPrivate = false,
}: EncryptionKeyProps) {
  const containerBorder = isPrivate
    ? 'border-[var(--kpi-orange)]/30'
    : 'border-[var(--border-color)]';
  const headerBg = isPrivate ? 'bg-[var(--warning-bg)]' : '';
  const headerBorder = isPrivate
    ? 'border-[var(--kpi-orange)]/20'
    : 'border-[var(--border-subtle)]';
  const icon = isPrivate ? <Unlock className="w-4 h-4 text-[var(--kpi-orange)]" /> : null;

  return (
    <div
      className={`bg-white rounded-[var(--radius-xl)] ${containerBorder} shadow-[var(--shadow-card)] overflow-hidden`}
    >
      <div
        className={`px-4 sm:px-5 py-4 border-b ${headerBorder} flex items-center justify-between ${headerBg}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-base font-semibold text-[var(--foreground)]">{title}</h3>
        </div>
        <CopyButton text={keyValue} />
      </div>
      <div className="p-4 sm:p-5">
        <div className="p-3 bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border-subtle)] overflow-hidden">
          <textarea
            readOnly
            className="font-mono text-[12px] xl:text-[9px] text-[var(--muted-foreground)] break-all leading-relaxed w-full h-20 border border-gray-300 rounded p-2 resize-none"
            value={keyValue}
          />
        </div>
        <p className="text-xs text-[var(--muted-foreground)] font-body mt-2">{description}</p>
      </div>
    </div>
  );
}
