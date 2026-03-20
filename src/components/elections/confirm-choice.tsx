import { Check, HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ElectionChoice } from '@/types/election';

interface ConfirmationStepProps {
  choice: ElectionChoice;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function ConfirmChoice({ choice, onBack, onConfirm, loading }: ConfirmationStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-(--kpi-navy)/20 bg-(--kpi-navy)/10">
          <HelpCircle className="h-8 w-8 text-(--kpi-navy)" />
        </div>
        <h4 className="font-display text-xl font-semibold text-(--foreground)">
          Підтвердіть свій вибір
        </h4>
        <p className="font-body text-sm text-(--muted-foreground)">
          Після підтвердження змінити голос неможливо
        </p>
      </div>

      <div className={cn('rounded-lg p-5', 'border-2 border-(--kpi-navy)/20 bg-(--kpi-navy)/5')}>
        <p className="font-body mb-1 text-xs tracking-wider text-(--muted-foreground) uppercase">
          Ваш вибір:
        </p>
        <div className="flex items-center gap-3">
          <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--kpi-navy) text-base font-bold text-white">
            {String.fromCharCode(65 + choice.position)}
          </span>
          <span className="font-body min-w-0 font-semibold wrap-break-word text-(--kpi-navy)">
            {choice.choice}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack} disabled={loading}>
          Змінити
        </Button>
        <Button
          variant="accent"
          size="lg"
          fullWidth
          onClick={onConfirm}
          loading={loading}
          icon={<Check className="h-4 w-4" />}
        >
          Підтвердити голос
        </Button>
      </div>
    </div>
  );
}
