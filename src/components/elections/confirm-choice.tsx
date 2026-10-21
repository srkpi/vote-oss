import { Check, HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/common';
import type { ElectionChoice } from '@/types/election';

interface ConfirmChoiceProps {
  choices: ElectionChoice[];
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function ConfirmChoice({ choices, onBack, onConfirm, loading }: ConfirmChoiceProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-kpi-navy/20 bg-kpi-navy/10">
          <HelpCircle className="h-8 w-8 text-kpi-navy" />
        </div>
        <h4 className="font-display text-xl font-semibold text-foreground">
          Підтвердіть свій вибір
        </h4>
        <p className="font-body text-sm text-muted-foreground">
          Після підтвердження змінити голос неможливо
        </p>
      </div>

      <div className="ph-no-capture space-y-2">
        <p className="font-body text-xs tracking-wider text-muted-foreground uppercase">
          {choices.length > 1 ? 'Ваші вибори:' : 'Ваш вибір:'}
        </p>
        {choices.map((choice) => (
          <div
            key={choice.id}
            className={cn('rounded-lg p-4', 'border-2 border-kpi-navy/20 bg-kpi-navy/5')}
          >
            <span className="font-body min-w-0 font-semibold wrap-break-word text-kpi-navy">
              {choice.choice}
            </span>
          </div>
        ))}
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
