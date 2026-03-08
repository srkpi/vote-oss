import { Badge } from '@/components/ui/badge';
import { getStatusLabel } from '@/lib/utils';
import type { ElectionStatus } from '@/types';

interface ElectionStatusBadgeProps {
  status: ElectionStatus;
  size?: 'sm' | 'md';
}

export function ElectionStatusBadge({ status, size = 'md' }: ElectionStatusBadgeProps) {
  const config = {
    upcoming: { variant: 'warning' as const, dot: true },
    open: { variant: 'success' as const, dot: true },
    closed: { variant: 'default' as const, dot: false },
  };

  return (
    <Badge variant={config[status].variant} size={size} dot={config[status].dot}>
      {status === 'open' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--success)]" />
        </span>
      )}
      {getStatusLabel(status)}
    </Badge>
  );
}
