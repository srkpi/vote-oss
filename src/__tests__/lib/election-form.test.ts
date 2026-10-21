import { zodResolver } from '@hookform/resolvers/zod';

import { ELECTION_CHOICE_MAX_LENGTH, ELECTION_TITLE_MAX_LENGTH } from '@/lib/constants';
import {
  createElectionFormSchema,
  getElectionCampusGroups,
  type ElectionFormValues,
} from '@/lib/schemas/election-form';

function validForm(): ElectionFormValues {
  return {
    title: 'Голосування',
    description: '',
    opensAt: '2026-10-22T12:00:00Z',
    closesAt: '2026-10-23T12:00:00Z',
    choices: [{ value: 'Так' }, { value: 'Ні' }],
    minChoices: 1,
    maxChoices: 1,
    winningConditions: {
      hasMostVotes: true,
      reachesPercentageEnabled: false,
      reachesPercentage: 50,
      reachesVotesEnabled: false,
      reachesVotes: 10,
      quorumEnabled: false,
      quorum: 100,
    },
    faculties: [],
    groups: [],
    studyForms: [],
    levelCourses: [],
    groupMemberships: [],
    bypassRequired: false,
    includeFacultyRestriction: true,
    shuffleChoices: false,
    publicViewing: false,
    anonymous: true,
  };
}

const schema = createElectionFormSchema({}, false);
function issuePaths(values: ElectionFormValues) {
  const result = schema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('election form validation', () => {
  it('accepts creation defaults once the required fields are filled', () => {
    expect(schema.safeParse(validForm()).success).toBe(true);
  });

  it('allows existing dates when editing an election', () => {
    const values = {
      ...validForm(),
      opensAt: '2020-01-01T12:00:00Z',
      closesAt: '2020-01-02T12:00:00Z',
    };
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('rejects blank titles and answer rows with precise field paths', () => {
    const values = validForm();
    values.title = '  ';
    values.choices[1].value = ' ';
    expect(issuePaths(values)).toEqual(expect.arrayContaining(['title', 'choices.1.value']));
  });

  it('enforces title and answer length limits', () => {
    const values = validForm();
    values.title = 'a'.repeat(ELECTION_TITLE_MAX_LENGTH + 1);
    values.choices[0].value = 'a'.repeat(ELECTION_CHOICE_MAX_LENGTH + 1);
    expect(issuePaths(values)).toEqual(expect.arrayContaining(['title', 'choices.0.value']));
  });

  it('rejects duplicate answers regardless of whitespace and case', () => {
    const values = validForm();
    values.choices = [{ value: ' Так ' }, { value: 'так' }];
    expect(issuePaths(values)).toContain('choices.root');
  });

  it.each(['', 'not-a-date'])('rejects invalid opening dates: %s', (opensAt) => {
    expect(issuePaths({ ...validForm(), opensAt })).toContain('opensAt');
  });

  it('rejects closing dates equal to or before the opening date', () => {
    const values = validForm();
    values.closesAt = values.opensAt;
    expect(issuePaths(values)).toContain('closesAt');
    values.closesAt = '2026-10-21T12:00:00Z';
    expect(issuePaths(values)).toContain('closesAt');
  });

  it('requires a quorum for a single-answer election and ignores hidden winning conditions', () => {
    const values = validForm();
    values.choices = [{ value: 'Підтримую' }];
    expect(issuePaths(values)).toContain('winningConditions.quorum');
    Object.assign(values.winningConditions, {
      quorumEnabled: true,
      reachesPercentageEnabled: true,
      reachesPercentage: 100,
      reachesVotesEnabled: true,
      reachesVotes: -1,
    });
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('requires at least one condition for multiple answers', () => {
    const values = validForm();
    values.winningConditions.hasMostVotes = false;
    expect(issuePaths(values)).toContain('winningConditions.root');
    values.winningConditions.quorumEnabled = true;
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('validates enabled condition ranges and integer thresholds', () => {
    const values = validForm();
    Object.assign(values.winningConditions, {
      reachesPercentageEnabled: true,
      reachesPercentage: 100,
      reachesVotesEnabled: true,
      reachesVotes: 1.5,
      quorumEnabled: true,
      quorum: 0,
    });
    expect(issuePaths(values)).toEqual(
      expect.arrayContaining([
        'winningConditions.reachesPercentage',
        'winningConditions.reachesVotes',
        'winningConditions.quorum',
      ]),
    );
    Object.assign(values.winningConditions, {
      reachesPercentage: 0,
      reachesVotes: 1,
      quorum: 10000,
    });
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('ignores disabled condition ranges', () => {
    const values = validForm();
    Object.assign(values.winningConditions, {
      reachesPercentage: 100,
      reachesVotes: -1,
      quorum: -1,
    });
    expect(schema.safeParse(values).success).toBe(true);
  });

  it('rejects reversed selection bounds', () => {
    expect(issuePaths({ ...validForm(), minChoices: 2, maxChoices: 1 })).toContain('minChoices');
  });

  it('resolves nested answer and winning-condition errors for React Hook Form', async () => {
    const values = validForm();
    values.choices[1].value = ' ';
    Object.assign(values.winningConditions, { quorumEnabled: true, quorum: 0 });
    const result = await zodResolver(schema)(values, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toMatchObject({
      choices: { 1: { value: { message: 'Варіант не може бути порожнім' } } },
      winningConditions: { quorum: { message: expect.any(String) } },
    });
  });

  it('resolves array and section errors alongside their registered fields', async () => {
    const values = validForm();
    values.choices[1].value = values.choices[0].value;
    values.winningConditions.hasMostVotes = false;
    const result = await zodResolver(schema)(values, undefined, {
      fields: {},
      names: ['choices.0.value', 'choices.1.value', 'winningConditions'],
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toMatchObject({
      choices: { root: { message: 'Варіанти не можуть повторюватися' } },
      winningConditions: { root: { message: 'Виберіть принаймні одну умову перемоги' } },
    });
  });
});

describe('election campus restrictions', () => {
  const facultyGroups = { ФІОТ: ['ІП-61', 'ІП-з61', 'ІП-61ф'], ФПМ: ['КВ-61'] };
  const campusSchema = createElectionFormSchema(facultyGroups, false);

  it('shares the same group filtering between the UI and validation', () => {
    expect(getElectionCampusGroups(facultyGroups, ['ФІОТ'], ['Correspondence'], [])).toEqual([
      'ІП-з61',
    ]);
    expect(getElectionCampusGroups(facultyGroups, ['ФІОТ'], [], [])).not.toContain('ІП-61ф');
  });

  it('rejects filters that leave no eligible groups', () => {
    const result = campusSchema.safeParse({
      ...validForm(),
      faculties: ['ФІОТ'],
      studyForms: ['Evening'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['levelCourses']);
    }
  });

  it('rejects faculties that do not contain any selected group', () => {
    const result = campusSchema.safeParse({
      ...validForm(),
      faculties: ['ФІОТ', 'ФПМ'],
      groups: ['ІП-61'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['faculties'],
        message: expect.stringContaining('ФПМ'),
      });
    }
  });

  it('defers campus-dependent validation while groups are loading', () => {
    expect(
      createElectionFormSchema({}, true).safeParse({
        ...validForm(),
        faculties: ['ФІОТ'],
        groups: ['ІП-61'],
        studyForms: ['Evening'],
      }).success,
    ).toBe(true);
  });
});
