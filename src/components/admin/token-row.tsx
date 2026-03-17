import { Clock, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, tokenExpiresLabel, tokenUsageColor, tokenUsageFraction } from '@/lib/utils';
import type { InviteToken } from '@/types/admin';

interface TokenRowProps {
  token: InviteToken;
  onDelete: () => void;
}

export function TokenRow({ token, onDelete }: TokenRowProps) {
  const fraction = tokenUsageFraction(token);
  const usageColor = tokenUsageColor(fraction);
  const { text: expiresText, urgent } = tokenExpiresLabel(token.valid_due);

  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        token.isOwn
          ? 'bg-[var(--kpi-blue-light)]/5 hover:bg-[var(--kpi-blue-light)]/10'
          : 'hover:bg-[var(--surface)]',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full navy-gradient flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {token.creator.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-body text-[var(--foreground)]">{token.creator.full_name}</p>
            <p className="text-xs font-body text-[var(--muted-foreground)]">
              {token.creator.user_id}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {token.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!token.manage_admins && !token.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="space-y-1.5 w-24">
          <p className="text-sm font-body text-[var(--foreground)]">
            <span className="font-semibold">{token.current_usage}</span>
            <span className="text-[var(--muted-foreground)]"> / {token.max_usage}</span>
          </p>
          <div className="h-1.5 w-full rounded-full bg-[var(--border-color)] overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', usageColor)}
              style={{ width: `${Math.min(fraction * 100, 100)}%` }}
            />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {urgent && <Clock className="w-3.5 h-3.5 text-[var(--kpi-orange)] shrink-0" />}
          <span
            className={cn(
              'text-sm font-body',
              urgent ? 'text-[var(--kpi-orange)] font-medium' : 'text-[var(--foreground)]',
            )}
          >
            {expiresText}
          </span>
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        {token.deletable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-[var(--error)] hover:bg-[var(--error-bg)]"
            title="Видалити токен"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
