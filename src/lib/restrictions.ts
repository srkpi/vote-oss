import { calculateCourse, parseGroupLevel, parseGroupYearEnteredDigit } from '@/lib/group-utils';
import { isAncestorInGraph } from '@/lib/utils';
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
 * Determines whether an admin may soft-delete an election.
 *
 * Rules:
 *  - Admins may only delete elections that:
 *    Were created by themselves OR by an admin they supervise
 *    (i.e. the admin is an ancestor of the creator in the hierarchy).
 *
 * @param admin       The requesting admin record.
 * @param election    The target election (restrictions + created_by userId).
 * @param adminGraph  Map of userId → promoted_by userId (the hierarchy graph).
 */
export function adminCanDeleteElection(
  admin: { restricted_to_faculty: boolean; faculty: string; user_id: string },
  election: { restrictions: ElectionRestriction[]; created_by: string },
  adminGraph: Map<string, string | null>,
): boolean {
  // The admin is the creator.
  if (election.created_by === admin.user_id) return true;

  // The admin must be an ancestor of the creator.
  return isAncestorInGraph(adminGraph, admin.user_id, election.created_by);
}

/**
 * Determines whether an admin may restore a soft-deleted election.
 *
 * Rules:
 *  - Admins may restore a deleted election in their faculty if:
 *      1. They deleted it themselves, OR
 *      2. They are an ancestor of the admin who deleted it.
 *
 * @param admin       The requesting admin record.
 * @param election    The target election (restrictions + deletedByUserId).
 * @param adminGraph  Map of userId → promoted_by userId (the hierarchy graph).
 */
export function adminCanRestoreElection(
  admin: { restricted_to_faculty: boolean; faculty: string; user_id: string },
  election: { restrictions: ElectionRestriction[]; deletedByUserId: string | null },
  adminGraph: Map<string, string | null>,
): boolean {
  if (!election.deletedByUserId) return false;

  // Self-deleted.
  if (election.deletedByUserId === admin.user_id) return true;

  // Admin must be an ancestor of the deleter.
  return isAncestorInGraph(adminGraph, admin.user_id, election.deletedByUserId);
}
