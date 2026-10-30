import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LocalDate } from '@/components/ui/local-time';
import { UserAvatarMenu } from '@/components/ui/user-avatar-menu';
import { cn } from '@/lib/utils/common';
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
        'transition-colors duration-150 hover:bg-surface',
        isCurrentUser && 'bg-kpi-blue-light/10',
      )}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <UserAvatarMenu
            userId={admin.userId}
            fullName={admin.fullName}
            avatarUrl={admin.avatarUrl}
            size={36}
            canDelete={canManageAdmins}
          />
          <div>
            <p className="font-body text-sm font-medium text-foreground">{admin.fullName}</p>
            <p className="font-body text-xs text-muted-foreground">{admin.userId}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-foreground">{admin.faculty}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-body text-sm text-foreground">{admin.group}</span>
      </td>
      <td className="px-4 py-3.5">
        <div>
          <p className="font-body text-sm text-foreground">
            <LocalDate date={admin.promotedAt} />
          </p>
          {admin.promoter && (
            <p className="font-body text-xs text-muted-foreground">{admin.promoter.fullName}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-1.5">
          {admin.manageAdmins && (
            <Badge variant="info" size="sm">
              Адміни
            </Badge>
          )}
          {admin.manageGroups && (
            <Badge variant="success" size="sm">
              Групи
            </Badge>
          )}
          {admin.managePetitions && (
            <Badge variant="warning" size="sm">
              Петиції
            </Badge>
          )}
          {admin.manageFaq && (
            <Badge variant="default" size="sm">
              FAQ
            </Badge>
          )}
          {admin.restrictedToFaculty && (
            <Badge variant="error" size="sm">
              Обмежений до підрозділу
            </Badge>
          )}
          {!admin.manageAdmins &&
            !admin.manageGroups &&
            !admin.managePetitions &&
            !admin.restrictedToFaculty &&
            !admin.manageFaq && (
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
                className="text-muted-foreground hover:bg-surface hover:text-kpi-navy"
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
