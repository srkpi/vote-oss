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
        'p-4 rounded-[var(--radius-lg)] border border-[var(--border-color)]',
        'bg-white shadow-[var(--shadow-sm)]',
        token.isOwn && 'border-[var(--kpi-navy)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full navy-gradient flex items-center justify-center text-white font-semibold shrink-0">
            {token.creator.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[var(--foreground)] font-body">
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
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
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

        <div className="flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <span className="text-xs font-body text-[var(--foreground)]">
            <span className="font-semibold">{token.current_usage}</span>
            <span className="text-[var(--muted-foreground)]"> / {token.max_usage}</span>
          </span>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-[var(--border-color)] overflow-hidden mt-3">
        <div
          className={cn('h-full rounded-full transition-all', usageColor)}
          style={{ width: `${Math.min(fraction * 100, 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <Clock
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            urgent ? 'text-[var(--kpi-orange)]' : 'text-[var(--muted-foreground)]',
          )}
        />
        <span
          className={cn(
            'text-xs font-body',
            urgent ? 'text-[var(--kpi-orange)] font-medium' : 'text-[var(--muted-foreground)]',
          )}
        >
          Дійсний до: {expiresText}
        </span>
      </div>
    </div>
  );
}
