import { isAncestorInGraph } from '@/lib/graph';
import {
  calculateCourse,
  parseGroupLevel,
  parseGroupYearEnteredDigit,
} from '@/lib/utils/group-utils';
import type { ElectionRestriction } from '@/types/election';

interface UserContext {
  faculty: string;
  group: string;
  speciality?: string;
  studyYear?: number;
  studyForm?: string;
}

/**
 * AND between different restriction types, OR within the same type.
 * Returns true if the user satisfies all restriction groups.
 *
 * @param restrictions    Election restrictions to check.
 * @param user            User attributes from JWT.
 * @param bypassedTypes   Restriction types the user has bypassed via token.
 * @param groupMemberships Group UUIDs the user is actively a member of.
 *                         Required when GROUP_MEMBERSHIP restrictions are present.
 */
export function checkRestrictions(restrictions: ElectionRestriction[], user: UserContext): boolean {
  return checkRestrictionsWithBypass(restrictions, user, null, null);
}

export function checkRestrictionsWithBypass(
  restrictions: ElectionRestriction[],
  user: UserContext,
  bypassedTypes: string[] | null,
  groupMemberships: string[] | null,
): boolean {
  if (restrictions.length === 0) return true;

  const bypassSet = bypassedTypes && bypassedTypes.length > 0 ? new Set(bypassedTypes) : null;
  const byType = new Map<string, string[]>();

  for (const r of restrictions) {
    if (bypassSet?.has(r.type)) continue;

    const existing = byType.get(r.type) ?? [];
    existing.push(r.value);
    byType.set(r.type, existing);
  }

  // After removing bypassed types, all remaining must be satisfied
  for (const [type, values] of byType) {
    let satisfied = false;

    switch (type) {
      case 'FACULTY':
        satisfied = values.includes(user.faculty);
        break;

      case 'GROUP':
        satisfied = values.includes(user.group);
        break;

      case 'SPECIALITY':
        satisfied = !!user.speciality && values.includes(user.speciality);
        break;

      case 'STUDY_YEAR':
        satisfied = user.studyYear != null && values.includes(String(user.studyYear));
        break;

      case 'STUDY_FORM':
        satisfied = !!user.studyForm && values.includes(user.studyForm);
        break;

      case 'LEVEL_COURSE': {
        const yearDigit = parseGroupYearEnteredDigit(user.group);
        if (yearDigit === null) return false;
        const level = parseGroupLevel(user.group);
        const course = calculateCourse(yearDigit);
        const userValue = `${level}${course}`;
        satisfied = values.includes(userValue);
        break;
      }

      case 'BYPASS_REQUIRED':
        // Never satisfied by user attributes alone; requires an explicit bypass token
        // that includes BYPASS_REQUIRED in its bypass_restrictions.
        return false;

      case 'GROUP_MEMBERSHIP':
        // `values` is an array of group UUIDs (OR semantics — user must be in at least one)
        if (!groupMemberships || groupMemberships.length === 0) return false;
        satisfied = values.some((groupId) => groupMemberships.includes(groupId));
        break;

      default:
        // Unknown restriction type — deny by default for forward-compatibility
        return false;
    }

    if (!satisfied) return false;
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
 */
export function adminCanDeleteElection(
  admin: { restricted_to_faculty: boolean; faculty: string; user_id: string },
  election: { restrictions: ElectionRestriction[]; created_by: string },
  adminGraph: Map<string, string | null>,
): boolean {
  if (election.created_by === admin.user_id) return true;
  return isAncestorInGraph(adminGraph, admin.user_id, election.created_by);
}

export function adminCanRestoreElection(
  admin: { restricted_to_faculty: boolean; faculty: string; user_id: string },
  election: { restrictions: ElectionRestriction[]; deletedByUserId: string | null },
  adminGraph: Map<string, string | null>,
): boolean {
  if (!election.deletedByUserId) return false;
  if (election.deletedByUserId === admin.user_id) return true;
  return isAncestorInGraph(adminGraph, admin.user_id, election.deletedByUserId);
}

/**
 * Can `admin` create or manage bypass tokens for `election`?
 * Rule: admin is the election author OR an ancestor of the author.
 */
export function adminCanManageElectionBypass(
  adminUserId: string,
  electionCreatedBy: string,
  adminGraph: Map<string, string | null>,
): boolean {
  if (electionCreatedBy === adminUserId) return true;
  return isAncestorInGraph(adminGraph, adminUserId, electionCreatedBy);
}
