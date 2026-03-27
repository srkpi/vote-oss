import type { BadgeVariant } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import type { StudyFormValue } from '@/lib/constants';
import {
  LEVEL_COURSE_LEVEL_LABELS,
  RESTRICTION_TYPE_LABELS,
  STUDY_FORM_LABELS,
} from '@/lib/constants';
import type { ElectionRestriction, RestrictionType } from '@/types/election';

interface ElectionRestrictionsProps {
  restrictions: ElectionRestriction[];
}

function formatLevelCourse(value: string): string {
  const level = value[0] as 'b' | 'm' | 'g';
  const course = value.slice(1);
  const levelLabel = LEVEL_COURSE_LEVEL_LABELS[level];

  // Singular form for display: Бакалавр, Магістр, Аспірант
  const singularMap: Record<string, string> = {
    b: 'Бакалавр',
    m: 'Магістр',
    g: 'Аспірант',
  };

  return `${singularMap[level] ?? levelLabel} ${course} курс`;
}

const formatValue = (type: RestrictionType, value: string) => {
  if (type === 'STUDY_FORM') {
    return STUDY_FORM_LABELS[value as StudyFormValue] || value;
  }
  if (type === 'STUDY_YEAR') {
    return `${value} курс`;
  }
  if (type === 'LEVEL_COURSE') {
    return formatLevelCourse(value);
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
    LEVEL_COURSE: 'warning',
  };
  return variants[type] || 'info';
};

export const AccessRestrictions = ({ restrictions }: ElectionRestrictionsProps) => {
  const groupedRestrictions = restrictions.reduce(
    (acc, curr) => {
      if (!acc[curr.type]) acc[curr.type] = [];
      acc[curr.type].push(curr.value);
      return acc;
    },
    {} as Record<RestrictionType, string[]>,
  );

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

          // Sort LEVEL_COURSE values by level then course for consistent display
          const sortedValues =
            type === 'LEVEL_COURSE'
              ? [...values].sort((a, b) => {
                  const levelOrder: Record<string, number> = { b: 0, m: 1, g: 2 };
                  const aLevel = levelOrder[a[0]!] ?? 99;
                  const bLevel = levelOrder[b[0]!] ?? 99;
                  if (aLevel !== bLevel) return aLevel - bLevel;
                  return parseInt(a.slice(1)) - parseInt(b.slice(1));
                })
              : [...values].sort();

          return (
            <div key={type} className="flex flex-col gap-2">
              <span className="font-body text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {label}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {sortedValues.map((val, index) => (
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
