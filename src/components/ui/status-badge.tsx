import { Badge, type BadgeSize, type BadgeVariant } from '@/components/ui/badge';

export type StatusKind =
  | 'upcoming'
  | 'open'
  | 'closed'
  | 'unavailable'
  | 'pending'
  | 'quorum'
  | 'deleted'
  | 'voted'
  | 'nonanonymous'
  | 'restricted';

interface StatusConfig {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<StatusKind, StatusConfig> = {
  upcoming: { variant: 'warning', label: 'Заплановано', dot: true },
  open: { variant: 'success', label: 'Активно', pulse: true },
  closed: { variant: 'secondary', label: 'Завершено' },
  unavailable: { variant: 'error', label: 'Недоступно' },
  pending: { variant: 'warning', label: 'На розгляді', dot: true },
  quorum: { variant: 'info', label: 'Кворум' },
  deleted: { variant: 'secondary', label: 'Видалено' },
  voted: { variant: 'info', label: 'Проголосовано' },
  nonanonymous: { variant: 'warning', label: 'Неанонімне' },
  restricted: { variant: 'info', label: 'Обмежено' },
};

interface StatusBadgeProps {
  status: StatusKind;
  size?: BadgeSize;
  muted?: boolean;
  label?: string;
}

export function StatusBadge({ status, size = 'md', muted, label }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant} size={size} dot={config.dot} muted={muted}>
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-success relative inline-flex h-1.5 w-1.5 rounded-full" />
        </span>
      )}
      {label ?? config.label}
    </Badge>
  );
}
