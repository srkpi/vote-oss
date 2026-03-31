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
  const { text: expiresText, urgent } = tokenExpiresLabel(token.validDue);

  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        token.isOwn ? 'bg-kpi-blue-light/5 hover:bg-kpi-blue-light/10' : 'hover:bg-surface',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="navy-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
            {token.creator.fullName.charAt(0)}
          </div>
          <div>
            <p className="font-body text-foreground text-sm">{token.creator.fullName}</p>
            <p className="font-body text-muted-foreground text-xs">{token.creator.userId}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {token.manageAdmins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {token.restrictedToFaculty && (
            <Badge variant="warning" size="sm">
              Керувати підрозділом
            </Badge>
          )}
          {!token.manageAdmins && !token.restrictedToFaculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="w-24 space-y-1.5">
          <p className="font-body text-foreground text-sm">
            <span className="font-semibold">{token.currentUsage}</span>
            <span className="text-muted-foreground"> / {token.maxUsage}</span>
          </p>
          <div className="bg-border-color h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full transition-all', usageColor)}
              style={{ width: `${Math.min(fraction * 100, 100)}%` }}
            />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {urgent && <Clock className="text-kpi-orange h-3.5 w-3.5 shrink-0" />}
          <span
            className={cn(
              'font-body text-sm',
              urgent ? 'text-kpi-orange font-medium' : 'text-foreground',
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
            className="text-error hover:bg-error-bg"
            title="Видалити токен"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
