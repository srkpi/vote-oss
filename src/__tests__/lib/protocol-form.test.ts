import { zodResolver } from '@hookform/resolvers/zod';

import { protocolBodySchema } from '@/lib/schemas/protocol';
import {
  protocolFormSchema,
  serializeProtocolForm,
  type ProtocolFormValues,
} from '@/lib/schemas/protocol-form';
const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];
function validForm(): ProtocolFormValues {
  return {
    name: ' Meeting ',
    date: '2026-11-01',
    number: '2',
    visitors: '',
    responsibles: [{ fullname: ' Chair ', posada: ' Head ' }],
    attendees: [
      {
        uid: 'attendee',
        userId: null,
        fullname: ' Person ',
        posada: ' Member ',
        present_text: ' присутній ',
        isPresent: true,
      },
    ],
    agenda: [
      {
        name: ' Question ',
        result: ' ',
        listeners: [{ fullname: ' Speaker ', speech: ' Report ' }],
        electionId: ids[0],
        choiceMapping: { [ids[0]]: 'yes', [ids[1]]: 'no', [ids[2]]: 'abstain' },
      },
    ],
  };
}
describe('protocol form', () => {
  it('produces a normalized request accepted by the existing API schema', () => {
    const payload = serializeProtocolForm(protocolFormSchema.parse(validForm()));
    expect(payload).toMatchObject({
      name: 'Meeting',
      number: 2,
      visitors: null,
      responsibles: [{ fullname: 'Chair', posada: 'Head' }],
      agendaItems: [{ result: null, listeners: [{ fullname: 'Speaker', speech: 'Report' }] }],
    });
    expect(payload.attendance[0]).not.toHaveProperty('uid');
    expect(payload.attendance[0]).not.toHaveProperty('isPresent');
    expect(protocolBodySchema.safeParse(payload).success).toBe(true);
  });
  it.each(['1.5', '1abc', '0', '-1', '9007199254740992'])(
    'rejects invalid protocol numbers: %s',
    (number) => {
      expect(protocolFormSchema.safeParse({ ...validForm(), number }).success).toBe(false);
    },
  );
  it.each(['1.5', '-1', 'abc'])('rejects invalid visitor counts: %s', (visitors) => {
    expect(protocolFormSchema.safeParse({ ...validForm(), visitors }).success).toBe(false);
  });
  it('requires at least one responsible, agenda item and listener', () => {
    const values = validForm();
    values.responsibles = [];
    values.agenda[0].listeners = [];
    const result = protocolFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['responsibles', 'agenda.0.listeners']),
      );
    }
    expect(protocolFormSchema.safeParse({ ...validForm(), agenda: [] }).success).toBe(false);
  });
  it('rejects missing elections and duplicate vote mappings', () => {
    const values = validForm();
    values.agenda[0].electionId = null;
    values.agenda[0].choiceMapping[ids[0]] = 'no';
    expect(protocolFormSchema.safeParse(values).success).toBe(false);
  });
  it('maps nested listener and attendee errors to RHF fields', async () => {
    const values = validForm();
    values.agenda[0].listeners[0].speech = ' ';
    values.attendees[0].posada = '';
    const result = await zodResolver(protocolFormSchema)(values, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors).toMatchObject({
      agenda: { 0: { listeners: { 0: { speech: { message: expect.any(String) } } } } },
      attendees: { 0: { posada: { message: expect.any(String) } } },
    });
  });
  it('preserves reordered nested arrays in the request', () => {
    const values = validForm();
    values.agenda.push({
      ...values.agenda[0],
      name: 'Second',
      listeners: [
        { fullname: 'Second', speech: 'Speech' },
        { fullname: 'First', speech: 'Report' },
      ],
    });
    values.agenda.reverse();
    const payload = serializeProtocolForm(protocolFormSchema.parse(values));
    expect(payload.agendaItems.map((item) => item.name)).toEqual(['Second', 'Question']);
    expect(payload.agendaItems[0].listeners.map((listener) => listener.fullname)).toEqual([
      'Second',
      'First',
    ]);
  });
});
