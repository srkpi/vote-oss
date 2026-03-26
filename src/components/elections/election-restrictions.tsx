import type { BadgeVariant } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import type { StudyFormValue } from '@/lib/constants';
import { RESTRICTION_TYPE_LABELS, STUDY_FORM_LABELS } from '@/lib/constants';
import type { ElectionRestriction, RestrictionType } from '@/types/election';

interface ElectionRestrictionsProps {
  restrictions: ElectionRestriction[];
}

export const AccessRestrictions = ({ restrictions }: ElectionRestrictionsProps) => {
  const groupedRestrictions = restrictions.reduce(
    (acc, curr) => {
      if (!acc[curr.type]) acc[curr.type] = [];
      acc[curr.type].push(curr.value);
      return acc;
    },
    {} as Record<RestrictionType, string[]>,
  );

  const formatValue = (type: RestrictionType, value: string) => {
    if (type === 'STUDY_FORM') {
      return STUDY_FORM_LABELS[value as StudyFormValue] || value;
    }
    if (type === 'STUDY_YEAR') {
      return `${value} курс`;
    }
    return value;
  };

  const getVariant = (type: RestrictionType): BadgeVariant => {
    const variants: Record<RestrictionType, BadgeVariant> = {
      FACULTY: 'info',
      GROUP: 'success',
      SPECIALITY: 'secondary',
      STUDY_YEAR: 'warning',
      STUDY_FORM: 'error',
    };
    return variants[type] || 'info';
  };

  return (
    <div className="border-border-color shadow-shadow-card overflow-hidden rounded-xl border bg-white p-5">
      <h3 className="font-display text-foreground mb-4 text-base font-semibold">
        Обмеження доступу
      </h3>
      <div className="space-y-3.5">
        {Object.entries(RESTRICTION_TYPE_LABELS).map(([typeKey, label]) => {
          const type = typeKey as RestrictionType;
          const values = groupedRestrictions[type];

          if (!values || !values.length) return null;

          return (
            <div key={type} className="flex flex-col gap-2">
              <span className="font-body text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {label}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {values.sort().map((val, index) => (
                  <Badge key={index} variant={getVariant(type)} size="md">
                    {formatValue(type, val)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
