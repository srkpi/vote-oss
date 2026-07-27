import { Alert } from '@/components/ui/alert';

interface PetitionStatusNoticeProps {
  approved: boolean;
  deleted: boolean;
}

export function PetitionStatusNotice({ approved, deleted }: PetitionStatusNoticeProps) {
  if (deleted) {
    return (
      <Alert variant="error" title="Петицію видалено">
        Ця петиція видалена й видима лише адміністраторам.
      </Alert>
    );
  }

  if (!approved) {
    return (
      <Alert variant="warning" title="Очікує підтвердження">
        Петиція ще не підтверджена адміністрацією і поки не відображається іншим користувачам.
      </Alert>
    );
  }

  return null;
}
