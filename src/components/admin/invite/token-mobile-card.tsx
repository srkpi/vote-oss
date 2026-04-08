import { Clock, Trash2, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, tokenExpiresLabel, tokenUsageColor, tokenUsageFraction } from '@/lib/utils/common';
import type { InviteToken } from '@/types/admin';

interface TokenRowProps {
  token: InviteToken;
  onDelete: () => void;
}

export function TokenMobileCard({ token, onDelete }: TokenRowProps) {
  const fraction = tokenUsageFraction(token);
  const usageColor = tokenUsageColor(fraction);
  const { text: expiresText, urgent } = tokenExpiresLabel(token.validDue);

  return (
    <div
      className={cn(
        'border-border-color rounded-lg border p-4',
        'shadow-shadow-sm bg-white',
        token.isOwn && 'border-kpi-navy',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white">
            {token.creator.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-foreground text-sm font-semibold">
                {token.creator.fullName}
              </p>
            </div>
          </div>
        </div>
        {token.deletable && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            className="text-error hover:bg-error-bg"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {token.manageAdmins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restrictedToFaculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!token.manageAdmins && !token.restrictedToFaculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Users className="text-muted-foreground h-3.5 w-3.5" />
          <span className="font-body text-foreground text-xs">
            <span className="font-semibold">{token.currentUsage}</span>
            <span className="text-muted-foreground"> / {token.maxUsage}</span>
          </span>
        </div>
      </div>

      <div className="bg-border-color mt-3 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full transition-all', usageColor)}
          style={{ width: `${Math.min(fraction * 100, 100)}%` }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <Clock
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            urgent ? 'text-kpi-orange' : 'text-muted-foreground',
          )}
        />
        <span
          className={cn(
            'font-body text-xs',
            urgent ? 'text-kpi-orange font-medium' : 'text-muted-foreground',
          )}
        >
          Дійсний до: {expiresText}
        </span>
      </div>
    </div>
  );
}
