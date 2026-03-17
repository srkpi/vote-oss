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
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-[var(--kpi-navy)]/10 border-2 border-[var(--kpi-navy)]/20 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-[var(--kpi-navy)]" />
        </div>
        <h4 className="font-display text-xl font-semibold text-[var(--foreground)]">
          Підтвердіть свій вибір
        </h4>
        <p className="text-sm text-[var(--muted-foreground)] font-body">
          Після підтвердження змінити голос неможливо
        </p>
      </div>

      <div
        className={cn(
          'p-5 rounded-[var(--radius-lg)]',
          'bg-[var(--kpi-navy)]/5 border-2 border-[var(--kpi-navy)]/20',
        )}
      >
        <p className="text-xs text-[var(--muted-foreground)] mb-1 font-body uppercase tracking-wider">
          Ваш вибір:
        </p>
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[var(--kpi-navy)] text-white flex items-center justify-center font-display font-bold text-base shrink-0">
            {String.fromCharCode(65 + choice.position)}
          </span>
          <span className="font-body font-semibold text-[var(--kpi-navy)] min-w-0 break-words">
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
          icon={<Check className="w-4 h-4" />}
        >
          Підтвердити голос
        </Button>
      </div>
    </div>
  );
}
