import { calculateCourse, parseGroupLevel, parseGroupYearEnteredDigit } from '@/lib/group-utils';
import type { ElectionRestriction } from '@/types/election';

interface UserContext {
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
}

/**
 * AND between different types, OR within the same type.
 * Returns true if the user satisfies all restriction groups.
 */
export function checkRestrictions(restrictions: ElectionRestriction[], user: UserContext): boolean {
  if (restrictions.length === 0) return true;

  const byType = new Map<string, string[]>();
  for (const r of restrictions) {
    const existing = byType.get(r.type) ?? [];
    existing.push(r.value);
    byType.set(r.type, existing);
  }

  for (const [type, values] of byType) {
    let userValue: string | undefined;

    switch (type) {
      case 'FACULTY':
        userValue = user.faculty;
        break;
      case 'GROUP':
        userValue = user.group;
        break;
      case 'SPECIALITY':
        userValue = user.speciality;
        break;
      case 'STUDY_YEAR':
        userValue = user.studyYear != null ? String(user.studyYear) : undefined;
        break;
      case 'STUDY_FORM':
        userValue = user.studyForm;
        break;
      case 'LEVEL_COURSE': {
        const yearDigit = parseGroupYearEnteredDigit(user.group);
        if (yearDigit === null) return false;
        const level = parseGroupLevel(user.group);
        const course = calculateCourse(yearDigit);
        userValue = `${level}${course}`;
        break;
      }
    }

    if (!userValue || !values.includes(userValue)) return false;
  }

  return true;
}

/**
 * Returns true if the faculty-restricted admin's faculty is in the FACULTY
 * restrictions (or there are no FACULTY restrictions → global election).
 */
export function adminCanAccessElection(
  adminFaculty: string,
  restrictions: ElectionRestriction[],
): boolean {
  const facRestrictions = restrictions.filter((r) => r.type === 'FACULTY');
  return facRestrictions.length === 0 || facRestrictions.some((r) => r.value === adminFaculty);
}

/**
 * For DELETE: faculty-restricted admin may only delete elections that
 * explicitly include their faculty (cannot delete global elections).
 */
export function adminCanDeleteElection(
  adminFaculty: string,
  restrictions: ElectionRestriction[],
): boolean {
  const facRestrictions = restrictions.filter((r) => r.type === 'FACULTY');
  return facRestrictions.some((r) => r.value === adminFaculty);
}
