import { z } from 'zod';

import {
  PROTOCOL_NAME_MAX_LENGTH,
  PROTOCOL_MAX_VISITORS,
  PROTOCOL_MAX_RESPONSIBLES,
  PROTOCOL_MAX_ATTENDEES,
  PROTOCOL_MAX_AGENDA_ITEMS,
  PROTOCOL_MAX_LISTENERS_PER_ITEM,
  PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH,
  PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH,
  PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH,
} from '@/lib/constants';
import { trimmedString, uuidSchema } from '@/lib/schemas/common';
import {
  protocolResponsibleSchema,
  protocolListenerSchema,
  protocolChoiceMappingSchema,
} from '@/lib/schemas/protocol';
import type { CreateProtocolRequest } from '@/types/protocol';
export const protocolFormSchema = z.object({
  name: trimmedString(PROTOCOL_NAME_MAX_LENGTH),
  date: z
    .string()
    .min(1, 'Вкажіть дату протоколу')
    .refine((value) => Number.isFinite(Date.parse(value)), 'Невірна дата'),
  number: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'Номер протоколу має бути цілим числом від 1')
    .refine((value) => Number.isSafeInteger(Number(value)), 'Номер завеликий'),
  visitors: z
    .string()
    .trim()
    .refine(
      (value) => !value || (/^\d+$/.test(value) && Number(value) <= PROTOCOL_MAX_VISITORS),
      `Ціле число від 0 до ${PROTOCOL_MAX_VISITORS}`,
    ),
  responsibles: z.array(protocolResponsibleSchema).min(1).max(PROTOCOL_MAX_RESPONSIBLES),
  attendees: z
    .array(
      protocolResponsibleSchema.extend({
        uid: z.string(),
        userId: z.string().nullable(),
        present_text: trimmedString(PROTOCOL_ATTENDEE_PRESENT_TEXT_MAX_LENGTH),
        isPresent: z.boolean(),
      }),
    )
    .max(PROTOCOL_MAX_ATTENDEES),
  agenda: z
    .array(
      z.object({
        name: trimmedString(PROTOCOL_AGENDA_ITEM_NAME_MAX_LENGTH),
        result: z.string().trim().max(PROTOCOL_AGENDA_ITEM_RESULT_MAX_LENGTH),
        listeners: z.array(protocolListenerSchema).min(1).max(PROTOCOL_MAX_LISTENERS_PER_ITEM),
        electionId: uuidSchema
          .nullable()
          .refine((value): boolean => value !== null, 'Оберіть привʼязане голосування'),
        choiceMapping: protocolChoiceMappingSchema,
      }),
    )
    .min(1)
    .max(PROTOCOL_MAX_AGENDA_ITEMS),
});
export type ProtocolFormValues = z.infer<typeof protocolFormSchema>;
export function serializeProtocolForm(values: ProtocolFormValues): CreateProtocolRequest {
  return {
    name: values.name,
    date: values.date,
    number: Number(values.number),
    visitors: values.visitors ? Number(values.visitors) : null,
    responsibles: values.responsibles.map(({ fullname, posada }) => ({ fullname, posada })),
    attendance: values.attendees.map(({ userId, fullname, posada, present_text }) => ({
      userId,
      fullname,
      posada,
      present_text,
    })),
    agendaItems: values.agenda.map(({ name, result, listeners, electionId, choiceMapping }) => ({
      name,
      result: result || null,
      listeners,
      electionId,
      choiceMapping,
    })),
  };
}
