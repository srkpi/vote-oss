import { AlertCircle, CheckCircle2, KeyRound, XCircle } from 'lucide-react';

import { RESTRICTION_TYPE_LABELS } from '@/lib/constants';
import { formatRestrictionValue } from '@/lib/utils/common';
import {
  calculateCourse,
  parseGroupLevel,
  parseGroupYearEnteredDigit,
} from '@/lib/utils/group-utils';
import type {
  ElectionRestrictedGroups,
  ElectionRestriction,
  RestrictionType,
} from '@/types/election';

interface UserContext {
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
}

interface RestrictedVoteBannerProps {
  restrictions: ElectionRestriction[];
  session: UserContext;
  bypassedTypes: string[] | null;
  restrictedGroups?: ElectionRestrictedGroups[];
  groupMember: string[] | null;
}

function getUserValueForType(type: RestrictionType, user: UserContext): string | undefined {
  switch (type) {
    case 'FACULTY':
      return user.faculty;
    case 'GROUP':
      return user.group;
    case 'SPECIALITY':
      return user.speciality;
    case 'STUDY_YEAR':
      return user.studyYear != null ? String(user.studyYear) : undefined;
    case 'STUDY_FORM':
      return user.studyForm;
    case 'LEVEL_COURSE':
      const yearDigit = parseGroupYearEnteredDigit(user.group);
      if (yearDigit === null) return undefined;
      const level = parseGroupLevel(user.group);
      const course = calculateCourse(yearDigit);
      return `${level}${course}`;
    case 'BYPASS_REQUIRED':
      // Never met without a token — always requires bypass
      return undefined;
  }
}

/**
 * Displayed when a user can *view* an election but cannot vote due to
 * restriction mismatches.
 */
export function RestrictedVoteBanner({
  restrictions,
  session,
  bypassedTypes,
  restrictedGroups,
  groupMember,
}: RestrictedVoteBannerProps) {
  // Group restrictions by type so we can render one row per type
  const byType = new Map<RestrictionType, string[]>();
  for (const r of restrictions) {
    const existing = byType.get(r.type) ?? [];
    existing.push(r.value);
    byType.set(r.type, existing);
  }

  const bypassSet = new Set(bypassedTypes ?? []);
  const hasBypassRequired = byType.has('BYPASS_REQUIRED');
  const bypassRequiredMet = bypassSet.has('BYPASS_REQUIRED');

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-error mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-display text-foreground font-semibold">
          Ви не можете взяти участь у цьому голосуванні
        </p>
      </div>

      {/* BYPASS_REQUIRED special display */}
      {hasBypassRequired && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-3 ${
            bypassRequiredMet ? 'border-success/20 bg-success-bg' : 'border-amber-200 bg-amber-50'
          }`}
        >
          {bypassRequiredMet ? (
            <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
          ) : (
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-body text-foreground text-sm font-medium">
              {RESTRICTION_TYPE_LABELS['BYPASS_REQUIRED']}
            </p>
            <p className="font-body text-muted-foreground text-xs">
              {bypassRequiredMet
                ? 'Токен доступу застосовано'
                : 'Потрібен токен доступу від організатора'}
            </p>
          </div>
          <span className="font-body shrink-0 text-xs font-semibold">
            {bypassRequiredMet ? 'Виконано' : 'Не виконано'}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {[...byType.entries()]
          .filter(([type]) => type !== 'BYPASS_REQUIRED')
          .map(([type, values]) => {
            const isBypassed = bypassSet.has(type);
            const userValue = getUserValueForType(type, session);

            let isMet = false;
            if (type === 'GROUP_MEMBERSHIP' && groupMember) {
              isMet = groupMember.some((id) => values.includes(id));
            } else {
              isMet = !!userValue && values.includes(userValue);
            }

            let icon: React.ReactNode;
            let rowClass: string;
            let statusLabel: string;

            if (isBypassed) {
              icon = <CheckCircle2 className="text-warning h-4 w-4 shrink-0" />;
              rowClass = 'border-warning/20 bg-warning-bg';
              statusLabel = 'Обійдено';
            } else if (isMet) {
              icon = <CheckCircle2 className="text-success h-4 w-4 shrink-0" />;
              rowClass = 'border-success/20 bg-success-bg';
              statusLabel = 'Виконано';
            } else {
              icon = <XCircle className="text-error h-4 w-4 shrink-0" />;
              rowClass = 'border-error/20 bg-error-bg';
              statusLabel = 'Не виконано';
            }

            return (
              <div
                key={type}
                className={`flex items-center gap-3 rounded-lg border p-3 ${rowClass}`}
              >
                {icon}
                <div className="min-w-0 flex-1">
                  <p className="font-body text-foreground text-sm font-medium">
                    {RESTRICTION_TYPE_LABELS[type] ?? type}
                  </p>
                  <p className="font-body text-muted-foreground text-xs">
                    Вимагається:{' '}
                    {values
                      .map((v) => formatRestrictionValue(type, v, restrictedGroups))
                      .join(', ')}
                  </p>
                  {userValue && !isMet && !isBypassed && (
                    <p className="font-body text-muted-foreground text-xs">
                      Ваше значення: {formatRestrictionValue(type, userValue)}
                    </p>
                  )}
                </div>
                <span className="font-body shrink-0 text-xs font-semibold">{statusLabel}</span>
              </div>
            );
          })}
      </div>

      {bypassSet.size > 0 && (
        <p className="font-body text-muted-foreground text-xs">
          Деякі обмеження обійдено за допомогою токена доступу, але інші залишаються невиконаними.
        </p>
      )}
    </div>
  );
}
