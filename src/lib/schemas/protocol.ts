import { z } from 'zod';

import {
  PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH,
  PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH,
  PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH,
  PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH,
  PROTOCOL_LISTENER_SPEECH_MAX_LENGTH,
  PROTOCOL_MAX_AGENDA_ITEMS,
  PROTOCOL_MAX_ATTENDEES,
  PROTOCOL_MAX_LISTENERS_PER_ITEM,
  PROTOCOL_MAX_RESPONSIBLES,
  PROTOCOL_MAX_VISITORS,
  PROTOCOL_NAME_MAX_LENGTH,
  PROTOCOL_REQUIRED_ELECTION_CHOICES,
  PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH,
  PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH,
} from '@/lib/constants';
import { trimmedString, uuidSchema } from '@/lib/schemas/common';

export const protocolResponsibleSchema = z.object({
  fullname: trimmedString(PROTOCOL_RESPONSIBLE_FULLNAME_MAX_LENGTH),
  posada: trimmedString(PROTOCOL_RESPONSIBLE_POSADA_MAX_LENGTH),
});
export const protocolChoiceMappingSchema = z
  .record(uuidSchema, z.enum(['yes', 'no', 'abstain']))
  .refine(
    (mapping) => Object.keys(mapping).length === PROTOCOL_REQUIRED_ELECTION_CHOICES,
    `choiceMapping must map all ${PROTOCOL_REQUIRED_ELECTION_CHOICES} choices`,
  )
  .refine(
    (mapping) => new Set(Object.values(mapping)).size === PROTOCOL_REQUIRED_ELECTION_CHOICES,
    'choiceMapping must use each of yes/no/abstain exactly once',
  );

export const protocolListenerSchema = z.object({
  fullname: trimmedString(PROTOCOL_LISTENER_FULLNAME_MAX_LENGTH),
  speech: trimmedString(PROTOCOL_LISTENER_SPEECH_MAX_LENGTH),
});

export const protocolBodySchema = z
  .object({
    name: trimmedString(PROTOCOL_NAME_MAX_LENGTH),
    date: z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), 'date is invalid')
      .transform((value) => new Date(value)),
    number: z.int().positive().max(Number.MAX_SAFE_INTEGER),
    visitors: z
      .number()
      .min(0)
      .max(PROTOCOL_MAX_VISITORS)
      .nullish()
      .transform((value) => (value == null ? null : Math.floor(value))),
    responsibles: z.array(protocolResponsibleSchema).min(1).max(PROTOCOL_MAX_RESPONSIBLES),
    attendance: z
      .array(
        protocolResponsibleSchema.extend({
          userId: z
            .string()
            .min(1)
            .nullish()
            .transform((value) => value ?? null),
          present_text: trimmedString(PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH),
        }),
      )
      .max(PROTOCOL_MAX_ATTENDEES)
      .nullish()
      .transform((value) => value ?? []),
    agendaItems: z
      .array(
        z.object({
          name: trimmedString(PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH),
          result: z
            .string()
            .trim()
            .max(PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH)
            .nullish()
            .transform((value) => value || null),
          listeners: z.array(protocolListenerSchema).min(1).max(PROTOCOL_MAX_LISTENERS_PER_ITEM),
          electionId: uuidSchema,
          choiceMapping: protocolChoiceMappingSchema,
        }),
      )
      .min(1)
      .max(PROTOCOL_MAX_AGENDA_ITEMS),
    ossSnapshot: z
      .object({
        name: z.string().trim().optional(),
        address: z.string().trim().optional(),
        email: z.string().trim().optional(),
        contact: z.string().trim().optional(),
      })
      .nullish(),
  })
  .transform(({ ossSnapshot, ...body }) => ({ ...body, ossSnapshotOverride: ossSnapshot ?? null }));

export type ValidatedProtocolBody = z.output<typeof protocolBodySchema>;
