import { Clock, Trash2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, tokenExpiresLabel, tokenUsageColor, tokenUsageFraction } from '@/lib/utils';
import type { InviteToken } from '@/types/admin';

interface TokenRowProps {
  token: InviteToken;
  onDelete: () => void;
}

export function TokenMobileCard({ token, onDelete }: TokenRowProps) {
  const fraction = tokenUsageFraction(token);
  const usageColor = tokenUsageColor(fraction);
  const { text: expiresText, urgent } = tokenExpiresLabel(token.valid_due);

  return (
    <div
      className={cn(
        'rounded-lg border border-(--border-color) p-4',
        'bg-white shadow-(--shadow-sm)',
        token.isOwn && 'border-(--kpi-navy)',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white">
            {token.creator.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-sm font-semibold text-(--foreground)">
                {token.creator.full_name}
              </p>
            </div>
          </div>
        </div>
        {token.deletable && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-(--error) hover:bg-(--error-bg)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {token.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений підрозділом
            </Badge>
          )}
          {!token.manage_admins && !token.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-(--muted-foreground)" />
          <span className="font-body text-xs text-(--foreground)">
            <span className="font-semibold">{token.current_usage}</span>
            <span className="text-(--muted-foreground)"> / {token.max_usage}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-(--border-color)">
        <div
          className={cn('h-full rounded-full transition-all', usageColor)}
          style={{ width: `${Math.min(fraction * 100, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <Clock
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            urgent ? 'text-(--kpi-orange)' : 'text-(--muted-foreground)',
          )}
        />
        <span
          className={cn(
            'font-body text-xs',
            urgent ? 'font-medium text-(--kpi-orange)' : 'text-(--muted-foreground)',
          )}
        >
          Дійсний до: {expiresText}
        </span>
      </div>
    </div>
  );
}
