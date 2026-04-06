import { Input } from '@/components/ui/form';
import {
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_QUORUM_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_VOTES_MIN,
} from '@/lib/constants';
import { pluralize } from '@/lib/utils';
import type { WinningConditionsState } from '@/types/election';

interface WinningConditionsSectionProps {
  state: WinningConditionsState;
  onChange: (next: WinningConditionsState) => void;
  errors: Record<string, string>;
}

export function WinningConditionsSection({
  state,
  onChange,
  errors,
}: WinningConditionsSectionProps) {
  const set = (patch: Partial<WinningConditionsState>) => onChange({ ...state, ...patch });

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.hasMostVotes}
          onChange={(e) => set({ hasMostVotes: e.target.checked })}
          className="border-border-color accent-kpi-navy mt-0.5 h-4 w-4 cursor-pointer rounded"
        />
        <div>
          <span className="font-body text-foreground text-sm font-medium">
            Найбільша кількість голосів
          </span>
          <p className="font-body text-muted-foreground text-xs">
            Варіант з найбільшою кількістю голосів перемагає
          </p>
        </div>
      </label>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.reachesPercentageEnabled}
            onChange={(e) => set({ reachesPercentageEnabled: e.target.checked })}
            className="border-border-color accent-kpi-navy mt-0.5 h-4 w-4 cursor-pointer rounded"
          />
          <span className="font-body text-foreground text-sm font-medium">
            Більше ніж{' '}
            {state.reachesPercentageEnabled ? (
              <span className="text-kpi-navy">{state.reachesPercentage}%</span>
            ) : (
              'N%'
            )}{' '}
            голосів від загальної кількості
          </span>
        </label>

        {state.reachesPercentageEnabled && (
          <div className="ml-7">
            <div className="flex max-w-xs items-center gap-2">
              <Input
                type="number"
                value={state.reachesPercentage}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) set({ reachesPercentage: v });
                }}
                min={WINNING_CONDITION_PERCENTAGE_MIN}
                max={WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE - 0.01}
                step={0.5}
                error={!!errors.reachesPercentage}
                className="w-24"
              />
              <span className="font-body text-muted-foreground text-sm">%</span>
            </div>
            {errors.reachesPercentage && (
              <p className="text-error mt-1 text-xs">{errors.reachesPercentage}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.reachesVotesEnabled}
            onChange={(e) => set({ reachesVotesEnabled: e.target.checked })}
            className="border-border-color accent-kpi-navy mt-0.5 h-4 w-4 cursor-pointer rounded"
          />
          <span className="font-body text-foreground text-sm font-medium">
            Щонайменше{' '}
            {state.reachesVotesEnabled ? (
              <>
                <span className="text-kpi-navy">{state.reachesVotes}</span>{' '}
                {pluralize(state.reachesVotes, ['голос', 'голоси', 'голосів'], false)}
              </>
            ) : (
              'N голосів'
            )}
          </span>
        </label>

        {state.reachesVotesEnabled && (
          <div className="ml-7">
            <Input
              type="number"
              value={state.reachesVotes}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) set({ reachesVotes: v });
              }}
              min={WINNING_CONDITION_VOTES_MIN}
              max={WINNING_CONDITION_VOTES_MAX}
              step={1}
              error={!!errors.reachesVotes}
              className="w-32"
            />
            {errors.reachesVotes && (
              <p className="text-error mt-1 text-xs">{errors.reachesVotes}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.quorumEnabled}
            onChange={(e) => set({ quorumEnabled: e.target.checked })}
            className="border-border-color accent-kpi-navy mt-0.5 h-4 w-4 cursor-pointer rounded"
          />
          <div>
            <span className="font-body text-foreground text-sm font-medium">
              Кворум{' '}
              {state.quorumEnabled ? (
                <>
                  <span className="text-kpi-navy">{state.quorum}</span>{' '}
                  {pluralize(state.quorum, ['голос', 'голоси', 'голосів'], false)}
                </>
              ) : (
                'N голосів'
              )}
            </span>
            <p className="font-body text-muted-foreground text-xs">
              Якщо кворум не досягнуто, переможці не визначаються
            </p>
          </div>
        </label>

        {state.quorumEnabled && (
          <div className="ml-7">
            <Input
              type="number"
              value={state.quorum}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) set({ quorum: v });
              }}
              min={WINNING_CONDITION_QUORUM_MIN}
              max={WINNING_CONDITION_QUORUM_MAX}
              step={1}
              error={!!errors.quorum}
              className="w-32"
            />
            {errors.quorum && <p className="text-error mt-1 text-xs">{errors.quorum}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
