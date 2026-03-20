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
  const containerBorder = isPrivate ? 'border-kpi-orange/30' : 'border-border-color';
  const headerBg = isPrivate ? 'bg-warning-bg' : '';
  const headerBorder = isPrivate ? 'border-kpi-orange/20' : 'border-border-subtle';
  const icon = isPrivate ? <Unlock className="text-kpi-orange h-4 w-4" /> : null;

  return (
    <div className={`rounded-xl bg-white ${containerBorder} shadow-shadow-card overflow-hidden`}>
      <div
        className={`border-b px-4 py-4 sm:px-5 ${headerBorder} flex items-center justify-between ${headerBg}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-foreground text-base font-semibold">{title}</h3>
        </div>
        <CopyButton text={keyValue} />
      </div>
      <div className="p-4 sm:p-5">
        <div className="border-border-subtle bg-surface overflow-hidden rounded-(--radius) border p-3">
          <textarea
            readOnly
            className="text-muted-foreground h-20 w-full resize-none rounded border border-gray-300 p-2 font-mono text-[12px] leading-relaxed break-all xl:text-[9px]"
            value={keyValue.replace(/\s+$/, '')}
          />
        </div>
        <p className="font-body text-muted-foreground mt-2 text-xs">{description}</p>
      </div>
    </div>
  );
}
