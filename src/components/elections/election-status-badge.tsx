import { Badge } from '@/components/ui/badge';
import { getStatusLabel } from '@/lib/utils/common';
import type { ElectionStatus } from '@/types/election';

interface ElectionStatusBadgeProps {
  status: ElectionStatus;
  size?: 'sm' | 'md';
  muted?: boolean;
}

export function ElectionStatusBadge({ status, size = 'md', muted }: ElectionStatusBadgeProps) {
  const config = {
    upcoming: { variant: 'warning' as const, dot: true },
    open: { variant: 'success' as const, dot: false },
    closed: { variant: 'default' as const, dot: false },
  };

  return (
    <Badge variant={config[status].variant} size={size} dot={config[status].dot} muted={muted}>
      {status === 'open' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full" />
        </span>
      )}
      {getStatusLabel(status)}
    </Badge>
  );
}
