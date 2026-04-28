import { Badge, type BadgeSize, type BadgeVariant } from '@/components/ui/badge';
import type { CandidateRegistrationStatus } from '@/types/candidate-registration';

interface Config {
  label: string;
  variant: BadgeVariant;
}

const CONFIG: Record<CandidateRegistrationStatus, Config> = {
  DRAFT: { label: 'Чернетка', variant: 'secondary' },
  AWAITING_TEAM: { label: 'Очікує команду', variant: 'warning' },
  PENDING_REVIEW: { label: 'На розгляді', variant: 'info' },
  APPROVED: { label: 'Затверджено', variant: 'success' },
  REJECTED: { label: 'Відхилено', variant: 'error' },
  WITHDRAWN: { label: 'Відкликано', variant: 'secondary' },
};

interface MyRegistrationStatusBadgeProps {
  status: CandidateRegistrationStatus;
  size?: BadgeSize;
}

export function MyRegistrationStatusBadge({ status, size = 'md' }: MyRegistrationStatusBadgeProps) {
  const config = CONFIG[status];
  return (
    <Badge variant={config.variant} size={size}>
      Заявка: {config.label}
    </Badge>
  );
}
