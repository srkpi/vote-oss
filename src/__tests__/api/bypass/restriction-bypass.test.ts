import * as allure from 'allure-js-commons';

import { prismaMock } from '@/__tests__/helpers/prisma-mock';

jest.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { checkRestrictions, checkRestrictionsWithBypass } from '@/lib/restrictions';
import type { ElectionRestriction } from '@/types/election';

const USER = {
  faculty: 'FICE',
  group: 'KV-91',
  speciality: 'Computer Science',
  studyYear: 3,
  studyForm: 'FullTime',
};

const FACULTY_RESTRICTION: ElectionRestriction[] = [{ type: 'FACULTY', value: 'FICE' }];
const GROUP_RESTRICTION: ElectionRestriction[] = [
  { type: 'FACULTY', value: 'FICE' },
  { type: 'GROUP', value: 'KV-91' },
];
const STUDY_FORM_RESTRICTION: ElectionRestriction[] = [{ type: 'STUDY_FORM', value: 'FullTime' }];
const MULTI_RESTRICTION: ElectionRestriction[] = [
  { type: 'FACULTY', value: 'FICE' },
  { type: 'GROUP', value: 'KV-91' },
  { type: 'STUDY_FORM', value: 'FullTime' },
];

describe('checkRestrictions', () => {
  beforeEach(() => {
    allure.feature('Restrictions');
    allure.story('Check Restrictions');
  });

  it('returns true when there are no restrictions', () => {
    expect(checkRestrictions([], USER)).toBe(true);
  });

  it('returns true when user matches all restrictions', () => {
    expect(checkRestrictions(FACULTY_RESTRICTION, USER)).toBe(true);
  });

  it('returns false when user does not match a restriction', () => {
    expect(checkRestrictions([{ type: 'FACULTY', value: 'FEL' }], USER)).toBe(false);
  });

  it('returns true when user matches all of multiple restriction types (AND logic)', () => {
    expect(checkRestrictions(GROUP_RESTRICTION, USER)).toBe(true);
  });

  it('returns false when user fails one restriction type in an AND group', () => {
    expect(
      checkRestrictions(
        [
          { type: 'FACULTY', value: 'FICE' },
          { type: 'GROUP', value: 'KV-99' }, // wrong group
        ],
        USER,
      ),
    ).toBe(false);
  });

  it('returns true when user matches at least one value within the same type (OR logic)', () => {
    expect(
      checkRestrictions(
        [
          { type: 'FACULTY', value: 'FEL' },
          { type: 'FACULTY', value: 'FICE' }, // matches
        ],
        USER,
      ),
    ).toBe(true);
  });
});

describe('checkRestrictionsWithBypass — empty bypassedTypes means NO bypass', () => {
  beforeEach(() => {
    allure.feature('Restrictions');
    allure.story('Bypass Logic');
  });

  it('null bypassedTypes applies full restriction check', () => {
    expect(checkRestrictionsWithBypass(FACULTY_RESTRICTION, USER, null, null)).toBe(true);
    expect(checkRestrictionsWithBypass([{ type: 'FACULTY', value: 'FEL' }], USER, null, null)).toBe(
      false,
    );
  });

  it('empty array [] bypassedTypes is treated as null — applies full check', () => {
    // Empty array should NOT bypass everything; it is equivalent to null
    expect(
      checkRestrictionsWithBypass(
        [{ type: 'FACULTY', value: 'FEL' }],
        USER,
        [], // empty — bypass nothing
        null,
      ),
    ).toBe(false);
  });

  it('empty array [] does NOT grant access to restricted election', () => {
    expect(
      checkRestrictionsWithBypass(
        [
          { type: 'FACULTY', value: 'FEL' },
          { type: 'GROUP', value: 'EL-21' },
        ],
        USER,
        [],
        null,
      ),
    ).toBe(false);
  });

  it('specific bypassedTypes skips only those restriction types', () => {
    // User is in FICE + KV-91, election restricts to FEL + GROUP KV-99
    // Bypass FACULTY → still fails GROUP check
    expect(
      checkRestrictionsWithBypass(
        [
          { type: 'FACULTY', value: 'FEL' },
          { type: 'GROUP', value: 'KV-91' },
        ],
        USER,
        ['FACULTY'], // bypass FACULTY restriction; GROUP must still pass
        null,
      ),
    ).toBe(true); // KV-91 matches GROUP KV-91
  });

  it('bypassing FACULTY but failing GROUP returns false', () => {
    expect(
      checkRestrictionsWithBypass(
        [
          { type: 'FACULTY', value: 'FEL' },
          { type: 'GROUP', value: 'KV-99' }, // KV-91 != KV-99
        ],
        USER,
        ['FACULTY'],
        null,
      ),
    ).toBe(false);
  });

  it('bypassing all present restriction types grants access', () => {
    expect(
      checkRestrictionsWithBypass(
        MULTI_RESTRICTION,
        USER,
        ['FACULTY', 'GROUP', 'STUDY_FORM'],
        null,
      ),
    ).toBe(true);
  });

  it('bypassing one of two failing restrictions still returns false for the other', () => {
    const wrongUser = { ...USER, faculty: 'FEL', studyForm: 'Correspondence' };
    // Bypass FACULTY only → STUDY_FORM still fails
    expect(checkRestrictionsWithBypass(STUDY_FORM_RESTRICTION, wrongUser, ['FACULTY'], null)).toBe(
      false,
    );
  });

  it('bypassing a type not present in restrictions has no effect', () => {
    // Bypass GROUP even though election has no GROUP restriction
    expect(checkRestrictionsWithBypass(FACULTY_RESTRICTION, USER, ['GROUP'], null)).toBe(true); // FACULTY still checked and passes
  });

  it('returns true when restrictions empty regardless of bypassedTypes', () => {
    expect(checkRestrictionsWithBypass([], USER, [], null)).toBe(true);
    expect(checkRestrictionsWithBypass([], USER, null, null)).toBe(true);
    expect(checkRestrictionsWithBypass([], USER, ['FACULTY'], null)).toBe(true);
  });
});
