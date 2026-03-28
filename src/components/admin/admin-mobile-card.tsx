import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { Admin } from '@/types/admin';

interface AdminMobileCardProps {
  admin: Admin;
  isCurrentUser: boolean;
  canManageAdmins: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export function AdminMobileCard({
  admin,
  isCurrentUser,
  canManageAdmins,
  onDelete,
  onEdit,
}: AdminMobileCardProps) {
  const showActions = !isCurrentUser && admin.deletable;

  return (
    <div
      className={cn(
        'border-border-color rounded-lg border p-4',
        'shadow-shadow-sm bg-white',
        isCurrentUser && 'border-kpi-navy',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="navy-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white">
            {admin.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-foreground text-sm font-semibold">{admin.fullName}</p>
            </div>
            <p className="font-body text-muted-foreground mt-0.5 text-xs">
              {admin.faculty} · {admin.group}
            </p>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1">
            {canManageAdmins && (
              <Button
                variant="ghost"
                size="xs"
                onClick={onEdit}
                className="text-muted-foreground hover:text-kpi-navy hover:bg-surface"
                title="Редагувати права"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              onClick={onDelete}
              className="text-error hover:bg-error-bg"
              title="Видалити адміністратора"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
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

      <p className="font-body text-muted-foreground mt-2 text-xs">
        Призначено: {formatDate(admin.promotedAt)}
      </p>
      {admin.promoter && (
        <p className="font-body text-muted-foreground text-xs">{admin.promoter.fullName}</p>
      )}
    </div>
  );
}
