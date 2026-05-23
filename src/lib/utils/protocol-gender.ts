import {
  ABSENT_TEXT_FEMALE,
  ABSENT_TEXT_MALE,
  PRESENT_TEXT_FEMALE,
  PRESENT_TEXT_MALE,
} from '@/lib/constants';
import { getGender } from '@/lib/utils/detect-gender';

const KNOWN_PRESENT = new Set([PRESENT_TEXT_MALE, PRESENT_TEXT_FEMALE]);
const KNOWN_ABSENT = new Set([ABSENT_TEXT_MALE, ABSENT_TEXT_FEMALE]);

/**
 * Returns the gender-appropriate presence text for the given full name.
 * Falls back to male form when the name is empty or gender is unknown.
 */
export function getGenderedPresentText(fullname: string): string {
  if (!fullname.trim()) return PRESENT_TEXT_MALE;
  return getGender(fullname.trim()) === 'female' ? PRESENT_TEXT_FEMALE : PRESENT_TEXT_MALE;
}

/**
 * Returns the gender-appropriate absence text for the given full name.
 * Falls back to male form when the name is empty or gender is unknown.
 */
export function getGenderedAbsentText(fullname: string): string {
  if (!fullname.trim()) return ABSENT_TEXT_MALE;
  return getGender(fullname.trim()) === 'female' ? ABSENT_TEXT_FEMALE : ABSENT_TEXT_MALE;
}

/**
 * Determines whether a present_text value indicates presence.
 * Handles both male/female variants and any legacy data by checking
 * the Ukrainian root "присутн" shared by "присутній" and "присутня".
 */
export function isAttendeePresentByText(presentText: string): boolean {
  return presentText.toLowerCase().includes('присутн');
}

/**
 * Given an existing present_text and a new full name, returns the
 * gender-appropriate equivalent when the text was a standard variant.
 * Returns the original text unchanged when it was a custom value.
 */
export function rederivePresenceText(currentText: string, newFullname: string): string {
  const lower = currentText.toLowerCase();
  if (KNOWN_PRESENT.has(lower)) return getGenderedPresentText(newFullname);
  if (KNOWN_ABSENT.has(lower)) return getGenderedAbsentText(newFullname);
  return currentText;
}
