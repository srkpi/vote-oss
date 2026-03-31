import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalDate } from '@/components/ui/local-time';
import { cn } from '@/lib/utils';
import type { Admin } from '@/types/admin';

interface AdminRowProps {
  admin: Admin;
  isCurrentUser: boolean;
  canManageAdmins: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export function AdminRow({
  admin,
  isCurrentUser,
  canManageAdmins,
  onDelete,
  onEdit,
}: AdminRowProps) {
  const showActions = !isCurrentUser && admin.deletable;

  return (
    <tr
      className={cn(
        'hover:bg-surface transition-colors duration-150',
        isCurrentUser && 'bg-kpi-blue-light/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
            {admin.fullName.charAt(0)}
          </div>
          <div>
            <p className="font-body text-foreground text-sm font-medium">{admin.fullName}</p>
            <p className="font-body text-muted-foreground text-xs">{admin.userId}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-foreground text-sm">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-foreground text-sm">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="font-body text-foreground text-sm">
            <LocalDate date={admin.promotedAt} />
          </p>
          {admin.promoter && (
            <p className="font-body text-muted-foreground text-xs">{admin.promoter.fullName}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {admin.manageAdmins && (
            <Badge variant="info" size="sm">
              Керування адмінами
            </Badge>
          )}
          {admin.restrictedToFaculty && (
            <Badge variant="warning" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!admin.manageAdmins && !admin.restrictedToFaculty && (
            <Badge variant="default" size="sm">
              Базові
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        {showActions && (
          <div className="flex items-center gap-1">
            {canManageAdmins && (
              <Button
                variant="ghost"
                size="md"
                onClick={onEdit}
                className="text-muted-foreground hover:text-kpi-navy hover:bg-surface"
                title="Редагувати права"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              onClick={onDelete}
              className="text-error hover:bg-error-bg"
              title="Видалити адміністратора"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
