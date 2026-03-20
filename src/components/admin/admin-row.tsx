import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { Admin } from '@/types/admin';

interface AdminRowProps {
  admin: Admin;
  isCurrentUser: boolean;
  onDelete: () => void;
}

export function AdminRow({ admin, isCurrentUser, onDelete }: AdminRowProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-(--surface)',
        isCurrentUser && 'bg-(--kpi-blue-light)/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
            {admin.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-body text-sm font-medium text-(--foreground)">{admin.full_name}</p>
            <p className="font-body text-xs text-(--muted-foreground)">{admin.user_id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-(--foreground)">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-(--foreground)">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="font-body text-sm text-(--foreground)">{formatDate(admin.promoted_at)}</p>
          {admin.promoter && (
            <p className="font-body text-xs text-(--muted-foreground)">
              {admin.promoter.full_name}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {admin.manage_admins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {admin.restricted_to_faculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!admin.manage_admins && !admin.restricted_to_faculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        {!isCurrentUser && admin.deletable && (
          <Button
            variant="ghost"
            size="md"
            onClick={onDelete}
            className="text-(--error) hover:bg-(--error-bg)"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}
