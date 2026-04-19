import { Percent, Trophy, Users, Vote } from 'lucide-react';

import { pluralize } from '@/lib/utils/common';
import type { WinningConditions } from '@/types/election';
import {
  DEFAULT_WINNING_CONDITIONS,
  DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE,
} from '@/types/election';

interface WinningConditionsDisplayProps {
  conditions?: WinningConditions | null;
  choicesCount: number;
}

interface ConditionRowProps {
  icon: React.ReactNode;
  label: string;
}

function ConditionRow({ icon, label }: ConditionRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-kpi-navy">{icon}</span>
      <span className="font-body text-foreground text-sm font-medium">{label}</span>
    </div>
  );
}

export function WinningConditionsDisplay({
  conditions,
  choicesCount,
}: WinningConditionsDisplayProps) {
  let wc: WinningConditions | null | undefined = conditions;
  if (!wc) {
    if (choicesCount === 1) {
      wc = DEFAULT_WINNING_CONDITIONS_SINGLE_CHOICE;
    } else {
      wc = DEFAULT_WINNING_CONDITIONS;
    }
  }

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white p-5">
      <h3 className="font-display text-foreground mb-4 text-base font-semibold">Умови перемоги</h3>
      <div className="space-y-3">
        {wc.hasMostVotes && (
          <ConditionRow icon={<Trophy className="h-4 w-4" />} label="Найбільша кількість голосів" />
        )}

        {wc.reachesPercentage !== null && (
          <ConditionRow
            icon={<Percent className="h-4 w-4" />}
            label={`Більше ніж ${wc.reachesPercentage}% від усіх голосів`}
          />
        )}

        {wc.reachesVotes !== null && (
          <ConditionRow
            icon={<Vote className="h-4 w-4" />}
            label={`Щонайменше ${pluralize(wc.reachesVotes, ['голос', 'голоси', 'голосів'])}`}
          />
        )}

        {wc.quorum !== null && (
          <ConditionRow
            icon={<Users className="h-4 w-4" />}
            label={`Кворум ${pluralize(wc.quorum, ['голос', 'голоси', 'голосів'])}`}
          />
        )}
      </div>
    </div>
  );
}
