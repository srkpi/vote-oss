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

describe('parseGroupStudyFormLetter', () => {
  it('returns null for groups with no form letter (FullTime-like)', () => {
    expect(parseGroupStudyFormLetter('KV-91')).toBeNull();
    expect(parseGroupStudyFormLetter('FT-21мн')).toBeNull();
    expect(parseGroupStudyFormLetter('ФТ-51')).toBeNull();
  });

  it('returns "з" for Correspondence groups', () => {
    expect(parseGroupStudyFormLetter('KV-з91')).toBe('з');
    expect(parseGroupStudyFormLetter('ІО-з31')).toBe('з');
  });

  it('returns "о" for Remote groups', () => {
    expect(parseGroupStudyFormLetter('KV-о51')).toBe('о');
  });

  it('returns "п" for Shortened groups', () => {
    expect(parseGroupStudyFormLetter('KV-п21')).toBe('п');
  });

  it('returns "в" for Evening groups', () => {
    expect(parseGroupStudyFormLetter('KV-в31')).toBe('в');
  });

  it('returns null for unparseable group names', () => {
    expect(parseGroupStudyFormLetter('INVALID')).toBeNull();
    expect(parseGroupStudyFormLetter('KV')).toBeNull();
    expect(parseGroupStudyFormLetter('')).toBeNull();
  });
});

// ── parseGroupLevel ──────────────────────────────────────────────────────────

describe('parseGroupLevel', () => {
  it('returns "b" for bachelor groups (no level letters)', () => {
    expect(parseGroupLevel('KV-91')).toBe('b');
    expect(parseGroupLevel('ФТ-51')).toBe('b');
    expect(parseGroupLevel('ІО-21')).toBe('b');
  });

  it('returns "m" for master groups with "мн"', () => {
    expect(parseGroupLevel('FT-21мн')).toBe('m');
    expect(parseGroupLevel('KV-51мн')).toBe('m');
  });

  it('returns "m" for master groups with "мп"', () => {
    expect(parseGroupLevel('FT-21мп')).toBe('m');
    expect(parseGroupLevel('ІО-41мп')).toBe('m');
  });

  it('returns "m" for master groups with extra noise letters (e.g. "мні")', () => {
    expect(parseGroupLevel('FT-21мні')).toBe('m');
    expect(parseGroupLevel('KV-11мпс')).toBe('m');
  });

  it('returns "g" for graduate groups with "ф"', () => {
    expect(parseGroupLevel('FT-21ф')).toBe('g');
    expect(parseGroupLevel('KV-11фі')).toBe('g');
  });

  it('returns "b" for unparseable group names (safe default)', () => {
    expect(parseGroupLevel('INVALID')).toBe('b');
  });
});

// ── parseGroupYearEnteredDigit ───────────────────────────────────────────────

describe('parseGroupYearEnteredDigit', () => {
  it('extracts the year digit correctly', () => {
    expect(parseGroupYearEnteredDigit('KV-91')).toBe(9);
    expect(parseGroupYearEnteredDigit('KV-21')).toBe(2);
    expect(parseGroupYearEnteredDigit('KV-51мн')).toBe(5);
    expect(parseGroupYearEnteredDigit('KV-з41')).toBe(4);
    expect(parseGroupYearEnteredDigit('ФТ-51')).toBe(5);
  });

  it('returns null for unparseable groups', () => {
    expect(parseGroupYearEnteredDigit('INVALID')).toBeNull();
    expect(parseGroupYearEnteredDigit('KV')).toBeNull();
  });
});

// ── calculateCourse ─────────────────────────────────────────────────────────

describe('calculateCourse', () => {
  describe('before September (no +1)', () => {
    it('handles digit in same decade, no adjustment needed', () => {
      // 2026 last digit=6; entered digit=5 (2025); 6>=5 → adj=5; course=6-5=1
      expect(calculateCourse(5, REF_DATE)).toBe(1);
      // entered digit=4 (2024); course=6-4=2
      expect(calculateCourse(4, REF_DATE)).toBe(2);
      // entered digit=2 (2022); course=6-2=4
      expect(calculateCourse(2, REF_DATE)).toBe(4);
    });

    it('handles digit in previous decade (adj -= 10)', () => {
      // 2026 last digit=6; entered digit=9 (2019); 6<9 → adj=9-10=-1; course=6-(-1)=7
      expect(calculateCourse(9, REF_DATE)).toBe(7);
      // entered digit=8 (2018); adj=8-10=-2; course=6-(-2)=8
      expect(calculateCourse(8, REF_DATE)).toBe(8);
      // entered digit=7 (2017); adj=-3; course=9
      expect(calculateCourse(7, REF_DATE)).toBe(9);
    });
  });

  describe('after September (adds +1)', () => {
    it('calculates course with +1 offset from September onward', () => {
      // Oct 2026, last digit=6, entered=5; course=6-5+1=2
      expect(calculateCourse(5, REF_DATE_AFTER_SEP)).toBe(2);
      // entered=2; course=6-2+1=5
      expect(calculateCourse(2, REF_DATE_AFTER_SEP)).toBe(5);
    });

    it('applies decade adjustment before +1', () => {
      // Oct 2026, entered=9; adj=-1; course=6-(-1)+1=8
      expect(calculateCourse(9, REF_DATE_AFTER_SEP)).toBe(8);
    });
  });
});

// ── parseGroupLevelCourse ────────────────────────────────────────────────────

describe('parseGroupLevelCourse', () => {
  it('returns correct LEVEL_COURSE for bachelor group', () => {
    // KV-51: year=5, adj=5, course=6-5=1, level=b → "b1"
    expect(parseGroupLevelCourse('KV-51', REF_DATE)).toBe('b1');
    // KV-21: year=2, course=4, level=b → "b4"
    expect(parseGroupLevelCourse('KV-21', REF_DATE)).toBe('b4');
  });

  it('returns correct LEVEL_COURSE for master group', () => {
    // FT-51мн: year=5, course=1, level=m → "m1"
    expect(parseGroupLevelCourse('FT-51мн', REF_DATE)).toBe('m1');
    // FT-41мп: year=4, course=2, level=m → "m2"
    expect(parseGroupLevelCourse('FT-41мп', REF_DATE)).toBe('m2');
  });

  it('returns correct LEVEL_COURSE for graduate group', () => {
    // FT-51ф: year=5, course=1, level=g → "g1"
    expect(parseGroupLevelCourse('FT-51ф', REF_DATE)).toBe('g1');
  });

  it('returns null for unparseable groups', () => {
    expect(parseGroupLevelCourse('INVALID', REF_DATE)).toBeNull();
  });

  it('works with Correspondence form letter before digits', () => {
    // KV-з51: form=з, year=5, course=1, level=b → "b1"
    expect(parseGroupLevelCourse('KV-з51', REF_DATE)).toBe('b1');
  });
});

// ── filterGroupsByStudyForms ─────────────────────────────────────────────────

describe('filterGroupsByStudyForms', () => {
  const groups = [
    'KV-91', // no form letter (FullTime-like)
    'KV-з91', // Correspondence
    'KV-о91', // Remote
    'KV-п91', // Shortened
    'KV-в91', // Evening
    'FT-21мн', // no form letter, master
  ];

  it('returns all groups unchanged when studyForms is empty', () => {
    expect(filterGroupsByStudyForms(groups, [])).toEqual(groups);
  });

  it('filters to groups with no form letter for FullTime', () => {
    const result = filterGroupsByStudyForms(groups, ['FullTime']);
    expect(result).toContain('KV-91');
    expect(result).toContain('FT-21мн');
    expect(result).not.toContain('KV-з91');
    expect(result).not.toContain('KV-о91');
    expect(result).not.toContain('KV-п91');
    expect(result).not.toContain('KV-в91');
  });

  it('filters to Correspondence groups only for Correspondence form', () => {
    const result = filterGroupsByStudyForms(groups, ['Correspondence']);
    expect(result).toEqual(['KV-з91']);
  });

  it('filters to Remote groups only for Remote form', () => {
    const result = filterGroupsByStudyForms(groups, ['Remote']);
    expect(result).toEqual(['KV-о91']);
  });

  it('filters to Shortened groups for Shortened form', () => {
    const result = filterGroupsByStudyForms(groups, ['Shortened']);
    expect(result).toEqual(['KV-п91']);
  });

  it('filters to Evening groups for Evening form', () => {
    const result = filterGroupsByStudyForms(groups, ['Evening']);
    expect(result).toEqual(['KV-в91']);
  });

  it('uses OR logic for multiple forms of same type', () => {
    const result = filterGroupsByStudyForms(groups, ['Correspondence', 'Remote']);
    expect(result).toContain('KV-з91');
    expect(result).toContain('KV-о91');
    expect(result).not.toContain('KV-91');
    expect(result).not.toContain('KV-п91');
  });

  it('combines FullTime with specific letter forms (OR logic)', () => {
    const result = filterGroupsByStudyForms(groups, ['FullTime', 'Correspondence']);
    expect(result).toContain('KV-91'); // FullTime match
    expect(result).toContain('KV-з91'); // Correspondence match
    expect(result).toContain('FT-21мн'); // FullTime match
    expect(result).not.toContain('KV-о91');
  });

  it('also filters FullTime-indistinguishable forms the same way', () => {
    // Extern, Other, None, OutOfPostgraduate → same as FullTime (no letter)
    const result = filterGroupsByStudyForms(groups, ['Extern']);
    expect(result).toContain('KV-91');
    expect(result).not.toContain('KV-з91');
  });
});

// ── filterGroupsByLevelCourses ───────────────────────────────────────────────

describe('filterGroupsByLevelCourses', () => {
  // As of REF_DATE (March 2026, yearLastDigit=6, before Sep):
  //   KV-51 → b1   KV-41 → b2   KV-31 → b3   KV-21 → b4
  //   FT-51мн → m1   FT-41мн → m2
  //   FT-51ф → g1
  const groups = ['KV-51', 'KV-41', 'KV-31', 'KV-21', 'FT-51мн', 'FT-41мн', 'FT-51ф'];

  it('returns all groups unchanged when levelCourses is empty', () => {
    expect(filterGroupsByLevelCourses(groups, [], REF_DATE)).toEqual(groups);
  });

  it('filters to bachelor 1st-year groups for "b1"', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1'], REF_DATE);
    expect(result).toEqual(['KV-51']);
  });

  it('filters to bachelor 1st and 2nd year groups for ["b1", "b2"]', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1', 'b2'], REF_DATE);
    expect(result).toContain('KV-51');
    expect(result).toContain('KV-41');
    expect(result).not.toContain('KV-31');
    expect(result).not.toContain('FT-51мн');
    expect(result).not.toContain('FT-51ф');
  });

  it('filters to master groups for "m1"', () => {
    const result = filterGroupsByLevelCourses(groups, ['m1'], REF_DATE);
    expect(result).toEqual(['FT-51мн']);
  });

  it('filters to graduate groups for "g1"', () => {
    const result = filterGroupsByLevelCourses(groups, ['g1'], REF_DATE);
    expect(result).toEqual(['FT-51ф']);
  });

  it('supports mixed level/course selection', () => {
    const result = filterGroupsByLevelCourses(groups, ['b1', 'm1'], REF_DATE);
    expect(result).toContain('KV-51');
    expect(result).toContain('FT-51мн');
    expect(result).not.toContain('KV-41');
  });

  it('excludes groups that cannot be parsed', () => {
    const withBadGroup = [...groups, 'INVALID'];
    const result = filterGroupsByLevelCourses(withBadGroup, ['b1'], REF_DATE);
    expect(result).not.toContain('INVALID');
  });

  it('works with Correspondence-prefixed groups', () => {
    // KV-з51 → b1 (same course, different study form)
    const result = filterGroupsByLevelCourses(['KV-з51', 'KV-з41'], ['b1'], REF_DATE);
    expect(result).toContain('KV-з51');
    expect(result).not.toContain('KV-з41');
  });
});
