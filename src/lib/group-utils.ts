/**
 * Utilities for parsing Ukrainian university group names.
 *
 * Group name format: {prefix}-{formLetters?}{yearDigit}{countDigit}{levelLetters?}
 *
 * Form letters (between '-' and first digit):
 *   'з' → Correspondence
 *   'о' → Remote
 *   'п' → Shortened
 *   'в' → Evening
 *   (none) → FullTime / other indistinguishable forms
 *
 * Level letters (after last digit):
 *   contains 'мн' or 'мп' → Master
 *   contains 'ф'           → Graduate (Postgraduate)
 *   (anything else)        → Bachelor
 */

/** Maps StudyForm value to its Cyrillic letter in the group name (null = no letter) */
export const STUDY_FORM_TO_LETTER: Record<string, string | null> = {
  Correspondence: 'з',
  Remote: 'о',
  Shortened: 'п',
  Evening: 'в',
  FullTime: null,
  None: null,
  Extern: null,
  OutOfPostgraduate: null,
  Other: null,
};

interface ParsedGroup {
  /** Characters before the first digit after '-' (may include form letters з,о,п,в) */
  formLetters: string;
  /** Single digit: last digit of the year the student entered university */
  yearDigit: number;
  /** Single digit: group count within year/faculty */
  countDigit: number;
  /** Characters after countDigit (may include level letters мн,мп,ф) */
  levelLetters: string;
}

function parseGroup(group: string): ParsedGroup | null {
  const dashIdx = group.indexOf('-');
  if (dashIdx === -1) return null;

  const suffix = group.slice(dashIdx + 1);
  // Match: any non-digit prefix, then exactly two digits, then the rest
  const match = suffix.match(/^([^0-9]*)(\d)(\d)(.*)$/);
  if (!match) return null;

  return {
    formLetters: match[1]!,
    yearDigit: parseInt(match[2]!, 10),
    countDigit: parseInt(match[3]!, 10),
    levelLetters: match[4]!,
  };
}

/**
 * Returns the study-form letter code found in the group name, or null.
 * null means the group has no encoded form (FullTime / indistinguishable).
 */
export function parseGroupStudyFormLetter(group: string): string | null {
  const parsed = parseGroup(group);
  if (!parsed) return null;

  for (const letter of ['з', 'о', 'п', 'в']) {
    if (parsed.formLetters.includes(letter)) return letter;
  }
  return null;
}

/**
 * Returns 'b' (bachelor), 'm' (master), or 'g' (graduate/postgraduate)
 * based on the level letters following the group count digit.
 */
export function parseGroupLevel(group: string): 'b' | 'm' | 'g' {
  const parsed = parseGroup(group);
  if (!parsed) return 'b';

  const letters = parsed.levelLetters.toLowerCase();
  // Check graduate first (ф), then master (мн / мп), else bachelor
  if (letters.includes('ф')) return 'g';
  if (letters.includes('мн') || letters.includes('мп')) return 'm';
  return 'b';
}

/**
 * Returns the year-entered digit (0-9) from the group name, or null.
 */
export function parseGroupYearEnteredDigit(group: string): number | null {
  const parsed = parseGroup(group);
  if (!parsed) return null;
  return parsed.yearDigit;
}

/**
 * Calculate the current academic course for a student given the last digit of
 * the year they entered university and the current date.
 *
 * Algorithm:
 *   adj = yearEnteredDigit
 *   if (currentYearLastDigit < adj) adj -= 10   // entered in previous decade
 *   course = currentYearLastDigit - adj          // before 1 Sep
 *          = currentYearLastDigit - adj + 1      // from 1 Sep onward
 */
export function calculateCourse(yearEnteredDigit: number, now: Date = new Date()): number {
  const yearLastDigit = now.getFullYear() % 10;
  let adj = yearEnteredDigit;

  if (yearLastDigit < adj) {
    adj -= 10;
  }

  // month is 0-indexed: August = 7, September = 8
  const isBeforeSeptember = now.getMonth() < 8;
  return isBeforeSeptember ? yearLastDigit - adj : yearLastDigit - adj + 1;
}

/**
 * Returns the composite LEVEL_COURSE string (e.g. 'b2', 'm1', 'g3') for a
 * group name, or null if the group name cannot be parsed.
 */
export function parseGroupLevelCourse(group: string, now: Date = new Date()): string | null {
  const yearDigit = parseGroupYearEnteredDigit(group);
  if (yearDigit === null) return null;

  const level = parseGroupLevel(group);
  const course = calculateCourse(yearDigit, now);
  return `${level}${course}`;
}

/**
 * Filter a list of group names to those whose study-form letter matches ANY
 * of the provided StudyForm values (OR logic within the same filter).
 * Returns all groups unchanged if studyForms is empty.
 */
export function filterGroupsByStudyForms(groups: string[], studyForms: string[]): string[] {
  if (studyForms.length === 0) return groups;

  return groups.filter((group) => {
    const groupLetter = parseGroupStudyFormLetter(group);

    return studyForms.some((form) => {
      const expected = STUDY_FORM_TO_LETTER[form];
      if (expected === undefined) return true; // unknown form value — don't filter
      if (expected === null) {
        // FullTime-like: group must have NO encoded form letter
        return groupLetter === null;
      }
      return groupLetter === expected;
    });
  });
}

/**
 * Filter a list of group names to those whose computed LEVEL_COURSE matches
 * ANY of the provided values (OR logic).
 * Returns all groups unchanged if levelCourses is empty.
 */
export function filterGroupsByLevelCourses(
  groups: string[],
  levelCourses: string[],
  now: Date = new Date(),
): string[] {
  if (levelCourses.length === 0) return groups;

  return groups.filter((group) => {
    const lc = parseGroupLevelCourse(group, now);
    return lc !== null && levelCourses.includes(lc);
  });
}
