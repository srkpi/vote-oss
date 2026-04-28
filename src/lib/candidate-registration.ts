/**
 * Candidate registration domain helpers.
 *
 * Forms are intentionally generic — there is no position-type enum.  ВКСУ
 * configures every requirement (campaign program, team size, eligibility
 * restrictions) per form when creating it.
 */

import type { RestrictionType } from '@prisma/client';

/**
 * Restriction types that ВКСУ may attach to a registration form.  We reuse
 * RestrictionType from elections, but exclude bypass / GROUP_MEMBERSHIP since
 * they don't make sense for candidate eligibility.
 */
export const ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES: RestrictionType[] = [
  'FACULTY',
  'GROUP',
  'SPECIALITY',
  'STUDY_YEAR',
  'STUDY_FORM',
  'LEVEL_COURSE',
];

export function isAllowedRegistrationFormRestrictionType(type: string): type is RestrictionType {
  return (ALLOWED_REGISTRATION_FORM_RESTRICTION_TYPES as string[]).includes(type);
}
