import { z } from 'zod';

import {
  ELECTION_TITLE_MAX_LENGTH,
  ELECTION_DESCRIPTION_MAX_LENGTH,
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MIN,
  ELECTION_CHOICES_MAX,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_MAX_CHOICES_MAX,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_VOTES_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_QUORUM_MAX,
} from '@/lib/constants';
import {
  filterGroupsByLevelCourses,
  filterGroupsByStudyForms,
  parseGroupLevel,
} from '@/lib/utils/group-utils';

export function getElectionCampusGroups(
  facultyGroups: Record<string, string[]>,
  faculties: string[],
  studyForms: string[],
  levelCourses: string[],
) {
  let groups = [...new Set(faculties.flatMap((faculty) => facultyGroups[faculty] ?? []))]
    .filter((group) => parseGroupLevel(group) !== 'g')
    .sort((a, b) => a.localeCompare(b, 'uk'));
  if (studyForms.length > 0) {
    groups = filterGroupsByStudyForms(groups, studyForms);
  }
  if (levelCourses.length > 0) {
    groups = filterGroupsByLevelCourses(groups, levelCourses);
  }
  return groups;
}

const dateField = (required: string) =>
  z
    .string()
    .min(1, required)
    .refine((value) => !value || Number.isFinite(Date.parse(value)), 'Невірна дата');

const electionFormFields = z.object({
  title: z
    .string()
    .max(
      ELECTION_TITLE_MAX_LENGTH,
      `Назва не може перевищувати ${ELECTION_TITLE_MAX_LENGTH} символів`,
    )
    .refine((value) => value.trim().length > 0, "Назва обов'язкова"),
  description: z
    .string()
    .max(
      ELECTION_DESCRIPTION_MAX_LENGTH,
      `Опис не може перевищувати ${ELECTION_DESCRIPTION_MAX_LENGTH} символів`,
    ),
  opensAt: dateField("Дата початку обов'язкова"),
  closesAt: dateField("Дата завершення обов'язкова"),
  choices: z
    .array(
      z.object({
        value: z
          .string()
          .max(
            ELECTION_CHOICE_MAX_LENGTH,
            `Варіант не може перевищувати ${ELECTION_CHOICE_MAX_LENGTH} символів`,
          )
          .refine((value) => value.trim().length > 0, 'Варіант не може бути порожнім'),
      }),
    )
    .min(ELECTION_CHOICES_MIN)
    .max(ELECTION_CHOICES_MAX),
  minChoices: z.int().min(ELECTION_MIN_CHOICES_MIN).max(ELECTION_MAX_CHOICES_MAX),
  maxChoices: z.int().min(ELECTION_MIN_CHOICES_MIN).max(ELECTION_MAX_CHOICES_MAX),
  winningConditions: z.object({
    hasMostVotes: z.boolean(),
    reachesPercentageEnabled: z.boolean(),
    reachesPercentage: z.number(),
    reachesVotesEnabled: z.boolean(),
    reachesVotes: z.number(),
    quorumEnabled: z.boolean(),
    quorum: z.number(),
  }),
  faculties: z.array(z.string()),
  groups: z.array(z.string()),
  studyForms: z.array(z.string()),
  levelCourses: z.array(z.string()),
  groupMemberships: z.array(z.string()),
  bypassRequired: z.boolean(),
  includeFacultyRestriction: z.boolean(),
  shuffleChoices: z.boolean(),
  publicViewing: z.boolean(),
  anonymous: z.boolean(),
});

export function createElectionFormSchema(
  facultyGroups: Record<string, string[]>,
  groupsLoading: boolean,
) {
  return electionFormFields.superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (Date.parse(values.closesAt) <= Date.parse(values.opensAt)) {
      issue(['closesAt'], 'Дата завершення має бути після дати початку');
    }
    if (
      new Set(values.choices.map(({ value }) => value.trim().toLowerCase())).size !==
      values.choices.length
    ) {
      issue(['choices', 'root'], 'Варіанти не можуть повторюватися');
    }
    if (values.minChoices > values.maxChoices) {
      issue(['minChoices'], 'Мінімум не може перевищувати максимум');
    }
    const wc = values.winningConditions;
    if (values.choices.length > 1) {
      if (
        !wc.hasMostVotes &&
        !wc.reachesPercentageEnabled &&
        !wc.reachesVotesEnabled &&
        !wc.quorumEnabled
      ) {
        issue(['winningConditions', 'root'], 'Виберіть принаймні одну умову перемоги');
      }
      if (
        wc.reachesPercentageEnabled &&
        (wc.reachesPercentage < WINNING_CONDITION_PERCENTAGE_MIN ||
          wc.reachesPercentage >= WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE)
      ) {
        issue(
          ['winningConditions', 'reachesPercentage'],
          `Значення повинно бути від ${WINNING_CONDITION_PERCENTAGE_MIN} до менш ніж ${WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE}`,
        );
      }
      if (
        wc.reachesVotesEnabled &&
        (!Number.isInteger(wc.reachesVotes) ||
          wc.reachesVotes < WINNING_CONDITION_VOTES_MIN ||
          wc.reachesVotes > WINNING_CONDITION_VOTES_MAX)
      ) {
        issue(
          ['winningConditions', 'reachesVotes'],
          `Ціле число від ${WINNING_CONDITION_VOTES_MIN} до ${WINNING_CONDITION_VOTES_MAX}`,
        );
      }
    } else if (!wc.quorumEnabled) {
      issue(['winningConditions', 'quorum'], 'Має бути задано для опитувань з 1 варіантом голосу');
    }
    if (
      wc.quorumEnabled &&
      (!Number.isInteger(wc.quorum) ||
        wc.quorum < WINNING_CONDITION_QUORUM_MIN ||
        wc.quorum > WINNING_CONDITION_QUORUM_MAX)
    ) {
      issue(
        ['winningConditions', 'quorum'],
        `Ціле число від ${WINNING_CONDITION_QUORUM_MIN} до ${WINNING_CONDITION_QUORUM_MAX}`,
      );
    }
    if (!groupsLoading && values.faculties.length > 0) {
      if (
        (values.studyForms.length > 0 || values.levelCourses.length > 0) &&
        getElectionCampusGroups(
          facultyGroups,
          values.faculties,
          values.studyForms,
          values.levelCourses,
        ).length === 0
      ) {
        issue(
          ['levelCourses'],
          'Жодна група не відповідає вибраним обмеженням. Змініть критерії або приберіть деякі фільтри.',
        );
      }
      if (values.groups.length > 0) {
        const redundant = values.faculties.filter(
          (faculty) =>
            !values.groups.some((group) => (facultyGroups[faculty] ?? []).includes(group)),
        );
        if (redundant.length > 0) {
          issue(
            ['faculties'],
            `Зайві підрозділи (не містять обраних груп): ${redundant.join(', ')}`,
          );
        }
      }
    }
  });
}

export type ElectionFormValues = z.infer<typeof electionFormFields>;
