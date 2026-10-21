import { z } from 'zod';

import { PETITION_TITLE_MAX_LENGTH, PETITION_TEXT_MAX_LENGTH } from '@/lib/constants';
import { restrictionSchema } from '@/lib/schemas/common';

// Inspect the operation before validating its fields: regular users always
// create petitions, whose election-only fields are intentionally ignored.
export const electionCreateEnvelopeSchema = z.looseObject({
  type: z.unknown().optional(),
});

export const petitionCreateBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
});

export const petitionSubmissionSchema = petitionCreateBodySchema.extend({
  title: z
    .string()
    .trim()
    .min(1, 'Вкажіть назву петиції')
    .max(PETITION_TITLE_MAX_LENGTH, `Назва — максимум ${PETITION_TITLE_MAX_LENGTH} символів`),
  description: z
    .string()
    .trim()
    .min(1, 'Вкажіть опис петиції')
    .max(PETITION_TEXT_MAX_LENGTH, `Опис — максимум ${PETITION_TEXT_MAX_LENGTH} символів`),
});

// Validate the JSON structure here. Date relationships, limits, permissions,
// and restrictions that depend on database records remain in the domain logic.
export const electionCreateBodySchema = z.object({
  type: z.enum(['ELECTION', 'PETITION']).optional(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  opensAt: z.string().optional(),
  closesAt: z.string().optional(),
  choices: z.array(z.string()).optional(),
  minChoices: z.int().optional(),
  maxChoices: z.int().optional(),
  restrictions: z.array(restrictionSchema).optional(),
  winningConditions: z.unknown().optional(),
  shuffleChoices: z.boolean().optional(),
  publicViewing: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export const electionUpdateBodySchema = electionCreateBodySchema.omit({ type: true });

export type PetitionCreateBody = z.infer<typeof petitionCreateBodySchema>;
