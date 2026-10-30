import { describe, it, expect } from 'vitest';

import {
  calculateCourse,
  filterGroupsByLevelCourses,
  filterGroupsByStudyForms,
  parseGroupLevel,
  parseGroupLevelCourse,
  parseGroupStudyFormLetter,
  parseGroupYearEnteredDigit,
} from '@/lib/utils/group-utils';

// Fixed reference date: March 27, 2026 (before September → use base formula)
// yearLastDigit = 6, isBeforeSeptember = true
// course = yearLastDigit - adj  (no +1)
const REF_DATE = new Date('2026-03-27T12:00:00Z');

// Fixed reference date in Sep: October 1 2026 (after Sep 1 → +1)
const REF_DATE_AFTER_SEP = new Date('2026-10-01T12:00:00Z');

// ── parseGroupStudyFormLetter ────────────────────────────────────────────────

describe('Parsing the group study form', () => {
  it('should return null for groups with no form letter (FullTime-like) when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('KV-91')).toBeNull();
    expect(parseGroupStudyFormLetter('FT-21мн')).toBeNull();
    expect(parseGroupStudyFormLetter('ФТ-51')).toBeNull();
  });

  it('should return "з" for Correspondence groups when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('KV-з91')).toBe('з');
    expect(parseGroupStudyFormLetter('ІО-з31')).toBe('з');
  });

  it('should return "о" for Remote groups when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('KV-о51')).toBe('о');
  });

  it('should return "п" for Shortened groups when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('KV-п21')).toBe('п');
  });

  it('should return "в" for Evening groups when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('KV-в31')).toBe('в');
  });

  it('should return null for unparseable group names when parsing the group study form', () => {
    expect(parseGroupStudyFormLetter('INVALID')).toBeNull();
    expect(parseGroupStudyFormLetter('KV')).toBeNull();
    expect(parseGroupStudyFormLetter('')).toBeNull();
  });
});

// ── parseGroupLevel ──────────────────────────────────────────────────────────

describe('Parsing the group degree level', () => {
  it('should return "b" for bachelor groups (no level letters) when parsing the group degree level', () => {
    expect(parseGroupLevel('KV-91')).toBe('b');
    expect(parseGroupLevel('ФТ-51')).toBe('b');
    expect(parseGroupLevel('ІО-21')).toBe('b');
  });

  it('should return "m" for master groups with "мн" when parsing the group degree level', () => {
    expect(parseGroupLevel('FT-21мн')).toBe('m');
    expect(parseGroupLevel('KV-51мн')).toBe('m');
  });

  it('should return "m" for master groups with "мп" when parsing the group degree level', () => {
    expect(parseGroupLevel('FT-21мп')).toBe('m');
    expect(parseGroupLevel('ІО-41мп')).toBe('m');
  });

  it('should return "m" for master groups with extra noise letters (e.g. "мні") when parsing the group degree level', () => {
    expect(parseGroupLevel('FT-21мні')).toBe('m');
    expect(parseGroupLevel('KV-11мпс')).toBe('m');
  });

  it('should return "g" for graduate groups with "ф" when parsing the group degree level', () => {
    expect(parseGroupLevel('FT-21ф')).toBe('g');
    expect(parseGroupLevel('KV-11фі')).toBe('g');
  });

  it('should return "b" for unparseable group names (safe default) when parsing the group degree level', () => {
    expect(parseGroupLevel('INVALID')).toBe('b');
  });
});

// ── parseGroupYearEnteredDigit ───────────────────────────────────────────────

describe('Parsing the group admission year', () => {
  it('should extract the admission year digit when a group name contains a year', () => {
    expect(parseGroupYearEnteredDigit('KV-91')).toBe(9);
    expect(parseGroupYearEnteredDigit('KV-21')).toBe(2);
    expect(parseGroupYearEnteredDigit('KV-51мн')).toBe(5);
    expect(parseGroupYearEnteredDigit('KV-з41')).toBe(4);
    expect(parseGroupYearEnteredDigit('ФТ-51')).toBe(5);
  });

  it('should return null for unparseable groups when parsing the group admission year', () => {
    expect(parseGroupYearEnteredDigit('INVALID')).toBeNull();
    expect(parseGroupYearEnteredDigit('KV')).toBeNull();
  });
});

// ── calculateCourse ─────────────────────────────────────────────────────────

describe('Calculating the current course', () => {
  describe('when the new academic year has not started', () => {
    it('should derive the course from elapsed years when admission was in the current decade', () => {
      // 2026 last digit=6; entered digit=5 (2025); 6>=5 → adj=5; course=6-5=1
      expect(calculateCourse(5, REF_DATE)).toBe(1);
      // entered digit=4 (2024); course=6-4=2
      expect(calculateCourse(4, REF_DATE)).toBe(2);
      // entered digit=2 (2022); course=6-2=4
      expect(calculateCourse(2, REF_DATE)).toBe(4);
    });

    it('should account for the previous decade when admission predates the current decade', () => {
      // 2026 last digit=6; entered digit=9 (2019); 6<9 → adj=9-10=-1; course=6-(-1)=7
      expect(calculateCourse(9, REF_DATE)).toBe(7);
      // entered digit=8 (2018); adj=8-10=-2; course=6-(-2)=8
      expect(calculateCourse(8, REF_DATE)).toBe(8);
      // entered digit=7 (2017); adj=-3; course=9
      expect(calculateCourse(7, REF_DATE)).toBe(9);
    });
  });

  describe('when the new academic year has started', () => {
    it('should advance the course by one when the new academic year begins in September', () => {
      // Oct 2026, last digit=6, entered=5; course=6-5+1=2
      expect(calculateCourse(5, REF_DATE_AFTER_SEP)).toBe(2);
      // entered=2; course=6-2+1=5
      expect(calculateCourse(2, REF_DATE_AFTER_SEP)).toBe(5);
    });

    it('should apply decade adjustment before +1', () => {
      // Oct 2026, entered=9; adj=-1; course=6-(-1)+1=8
      expect(calculateCourse(9, REF_DATE_AFTER_SEP)).toBe(8);
    });
  });
});

// ── parseGroupLevelCourse ────────────────────────────────────────────────────

describe('Parsing the group degree and course', () => {
  it('should return the bachelor degree and course when parsing a bachelor group', () => {
    // KV-51: year=5, adj=5, course=6-5=1, level=b → "b1"
    expect(parseGroupLevelCourse('KV-51', REF_DATE)).toBe('b1');
    // KV-21: year=2, course=4, level=b → "b4"
    expect(parseGroupLevelCourse('KV-21', REF_DATE)).toBe('b4');
  });

  it('should return the master degree and course when parsing a master group', () => {
    // FT-51мн: year=5, course=1, level=m → "m1"
    expect(parseGroupLevelCourse('FT-51мн', REF_DATE)).toBe('m1');
    // FT-41мп: year=4, course=2, level=m → "m2"
    expect(parseGroupLevelCourse('FT-41мп', REF_DATE)).toBe('m2');
  });

  it('should return the graduate degree and course when parsing a graduate group', () => {
    // FT-51ф: year=5, course=1, level=g → "g1"
    expect(parseGroupLevelCourse('FT-51ф', REF_DATE)).toBe('g1');
  });

  it('should return null for unparseable groups when parsing the group degree and course', () => {
    expect(parseGroupLevelCourse('INVALID', REF_DATE)).toBeNull();
  });

  it('should identify the degree and course when a correspondence form letter precedes the year', () => {
    // KV-з51: form=з, year=5, course=1, level=b → "b1"
    expect(parseGroupLevelCourse('KV-з51', REF_DATE)).toBe('b1');
  });
});

// ── filterGroupsByStudyForms ─────────────────────────────────────────────────

describe('Filtering groups by study form', () => {
  const groups = [
    'KV-91', // no form letter (FullTime-like)
    'KV-з91', // Correspondence
    'KV-о91', // Remote
    'KV-п91', // Shortened
    'KV-в91', // Evening
    'FT-21мн', // no form letter, master
  ];

  it('should return all groups unchanged when studyForms is empty', () => {
    expect(filterGroupsByStudyForms(groups, [])).toEqual(groups);
  });

  it('should filter to groups with no form letter for FullTime when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['FullTime']);
    expect(result).toContain('KV-91');
    expect(result).toContain('FT-21мн');
    expect(result).not.toContain('KV-з91');
    expect(result).not.toContain('KV-о91');
    expect(result).not.toContain('KV-п91');
    expect(result).not.toContain('KV-в91');
  });

  it('should filter to Correspondence groups only for Correspondence form when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['Correspondence']);
    expect(result).toEqual(['KV-з91']);
  });

  it('should filter to Remote groups only for Remote form when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['Remote']);
    expect(result).toEqual(['KV-о91']);
  });

  it('should filter to Shortened groups for Shortened form when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['Shortened']);
    expect(result).toEqual(['KV-п91']);
  });

  it('should filter to Evening groups for Evening form when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['Evening']);
    expect(result).toEqual(['KV-в91']);
  });

  it('should include groups matching any selected study form when several forms are selected', () => {
    const result = filterGroupsByStudyForms(groups, ['Correspondence', 'Remote']);
    expect(result).toContain('KV-з91');
    expect(result).toContain('KV-о91');
    expect(result).not.toContain('KV-91');
    expect(result).not.toContain('KV-п91');
  });

  it('should combine FullTime with specific letter forms (OR logic) when filtering groups by study form', () => {
    const result = filterGroupsByStudyForms(groups, ['FullTime', 'Correspondence']);
    expect(result).toContain('KV-91'); // FullTime match
    expect(result).toContain('KV-з91'); // Correspondence match
    expect(result).toContain('FT-21мн'); // FullTime match
    expect(result).not.toContain('KV-о91');
  });

  it('should include groups without a form letter when selecting equivalent full-time study forms', () => {
    // Extern, Other, None, OutOfPostgraduate → same as FullTime (no letter)
    const result = filterGroupsByStudyForms(groups, ['Extern']);
    expect(result).toContain('KV-91');
    expect(result).not.toContain('KV-з91');
  });
});

// ── filterGroupsByLevelCourses ───────────────────────────────────────────────

describe('Filtering groups by degree and course', () => {
  // As of REF_DATE (March 2026, yearLastDigit=6, before Sep):
  //   KV-51 → b1   KV-41 → b2   KV-31 → b3   KV-21 → b4
  //   FT-51мн → m1   FT-41мн → m2
  //   FT-51ф → g1
  const groups = ['KV-51', 'KV-41', 'KV-31', 'KV-21', 'FT-51мн', 'FT-41мн', 'FT-51ф'];

  it('should return all groups unchanged when levelCourses is empty', () => {
    expect(filterGroupsByLevelCourses(groups, [], REF_DATE)).toEqual(groups);
  });

  it('should filter to bachelor 1st-year groups for "b1" when filtering groups by degree and course', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1'], REF_DATE);
    expect(result).toEqual(['KV-51']);
  });

  it('should filter to bachelor 1st and 2nd year groups for ["b1", "b2"] when filtering groups by degree and course', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1', 'b2'], REF_DATE);
    expect(result).toContain('KV-51');
    expect(result).toContain('KV-41');
    expect(result).not.toContain('KV-31');
    expect(result).not.toContain('FT-51мн');
    expect(result).not.toContain('FT-51ф');
  });

  it('should filter to master groups for "m1" when filtering groups by degree and course', () => {
    const result = filterGroupsByLevelCourses(groups, ['m1'], REF_DATE);
    expect(result).toEqual(['FT-51мн']);
  });

  it('should filter to graduate groups for "g1" when filtering groups by degree and course', () => {
    const result = filterGroupsByLevelCourses(groups, ['g1'], REF_DATE);
    expect(result).toEqual(['FT-51ф']);
  });

  it('should support mixed level/course selection when filtering groups by degree and course', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1', 'm1'], REF_DATE);
    expect(result).toContain('KV-51');
    expect(result).toContain('FT-51мн');
    expect(result).not.toContain('KV-41');
  });

  it('should exclude groups that cannot be parsed when filtering groups by degree and course', () => {
    const withBadGroup = [...groups, 'INVALID'];
    const result = filterGroupsByLevelCourses(withBadGroup, ['b1'], REF_DATE);
    expect(result).not.toContain('INVALID');
  });

  it('should include matching correspondence groups when filtering by degree and course', () => {
    // KV-з51 → b1 (same course, different study form)
    const result = filterGroupsByLevelCourses(['KV-з51', 'KV-з41'], ['b1'], REF_DATE);
    expect(result).toContain('KV-з51');
    expect(result).not.toContain('KV-з41');
  });
});
