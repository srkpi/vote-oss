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
        <div className="border-kpi-navy/20 bg-kpi-navy/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2">
          <HelpCircle className="text-kpi-navy h-8 w-8" />
        </div>
        <h4 className="font-display text-foreground text-xl font-semibold">
          Підтвердіть свій вибір
        </h4>
        <p className="font-body text-muted-foreground text-sm">
          Після підтвердження змінити голос неможливо
        </p>
      </div>

      <div className={cn('rounded-lg p-5', 'border-kpi-navy/20 bg-kpi-navy/5 border-2')}>
        <p className="font-body text-muted-foreground mb-1 text-xs tracking-wider uppercase">
          Ваш вибір:
        </p>
        <div className="flex items-center gap-3">
          <span className="font-display bg-kpi-navy flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white">
            {String.fromCharCode(65 + choice.position)}
          </span>
          <span className="font-body text-kpi-navy min-w-0 font-semibold wrap-break-word">
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
