import { z } from 'zod';

import { parseRequestBody } from '@/lib/api/request';
import { campaignCreateBodySchema, campaignDatesBodySchema } from '@/lib/schemas/campaign';
import { electionUpdateBodySchema } from '@/lib/schemas/election';
import { faqCategoryBodySchema, faqItemBodySchema, faqReorderBodySchema } from '@/lib/schemas/faq';
import { adminInviteBodySchema, groupUpdateBodySchema } from '@/lib/schemas/group';
import { protocolBodySchema } from '@/lib/schemas/protocol';

const choiceIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];
const protocolInput = {
  name: '  Meeting  ',
  date: '2026-10-21',
  number: 1,
  visitors: 2.9,
  responsibles: [{ fullname: '  Person  ', posada: '  Chair  ' }],
  agendaItems: [
    {
      name: '  Agenda  ',
      result: ' ',
      listeners: [{ fullname: 'Person', speech: 'Speech' }],
      electionId: '44444444-4444-4444-8444-444444444444',
      choiceMapping: { [choiceIds[0]]: 'yes', [choiceIds[1]]: 'no', [choiceIds[2]]: 'abstain' },
    },
  ],
  ossSnapshot: { name: '  Council  ' },
};

describe('JSON request parsing', () => {
  it('returns 400 for malformed JSON', async () => {
    const result = await parseRequestBody(
      new Request('http://localhost', {
        method: 'POST',
        body: '{',
      }),
      faqCategoryBodySchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      expect(await result.response.json()).toMatchObject({ message: 'Invalid JSON body' });
    }
  });

  it.each([null, [], 42, { title: {} }])('returns 400 for invalid input: %j', async (input) => {
    const result = await parseRequestBody(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
      faqCategoryBodySchema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it('returns normalized input and strips unknown properties', async () => {
    const result = await parseRequestBody(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ title: '  Category  ', manageFaq: true }),
      }),
      faqCategoryBodySchema,
    );
    expect(result).toEqual({ ok: true, data: { title: 'Category' } });
  });
});

describe('protocol validation', () => {
  it('preserves normalization and optional-field defaults', () => {
    const result = protocolBodySchema.parse(protocolInput);
    expect(result).toMatchObject({
      name: 'Meeting',
      date: new Date('2026-10-21'),
      visitors: 2,
      attendance: [],
      responsibles: [{ fullname: 'Person', posada: 'Chair' }],
      ossSnapshotOverride: { name: 'Council' },
      agendaItems: [{ name: 'Agenda', result: null }],
    });
  });

  it.each([
    { number: 1.5 },
    { date: 'invalid' },
    { visitors: -1 },
    { responsibles: [null] },
    { attendance: [{ fullname: 'Person' }] },
    { agendaItems: [null] },
    { ossSnapshot: [] },
  ])('rejects malformed protocol data: %j', (fields) => {
    expect(protocolBodySchema.safeParse({ ...protocolInput, ...fields }).success).toBe(false);
  });

  it('rejects malformed listeners and non-bijective choice mappings', () => {
    for (const fields of [
      { listeners: [null] },
      { choiceMapping: { [choiceIds[0]]: 'yes', [choiceIds[1]]: 'yes', [choiceIds[2]]: 'no' } },
      { choiceMapping: { bad: 'yes' } },
    ]) {
      const input = {
        ...protocolInput,
        agendaItems: [{ ...protocolInput.agendaItems[0], ...fields }],
      };
      expect(protocolBodySchema.safeParse(input).success).toBe(false);
    }
  });

  it('generates documentation for the JSON input, rather than transformed dates', () => {
    const schema = z.toJSONSchema(protocolBodySchema, { target: 'openapi-3.0', io: 'input' });
    expect(schema.properties?.date).toMatchObject({ type: 'string' });
    expect(schema.properties).toHaveProperty('ossSnapshot');
    expect(schema.properties).not.toHaveProperty('ossSnapshotOverride');
  });
});

describe('shared request schemas', () => {
  it('rejects malformed election updates', () => {
    expect(electionUpdateBodySchema.safeParse({ choices: 'invalid' }).success).toBe(false);
    expect(electionUpdateBodySchema.safeParse({ restrictions: [null] }).success).toBe(false);
  });

  it('validates nested requisites and invite permission types', () => {
    expect(groupUpdateBodySchema.safeParse({ requisites: { email: [] } }).success).toBe(false);
    expect(adminInviteBodySchema.safeParse({ manageAdmins: 'false' }).success).toBe(false);
    expect(adminInviteBodySchema.safeParse({ maxUsage: 1.5 }).success).toBe(false);
  });

  it('validates campaign fields in create and update requests', () => {
    expect(campaignCreateBodySchema.safeParse({ signatureCollection: 'true' }).success).toBe(false);
    expect(campaignCreateBodySchema.safeParse({ restrictions: [null] }).success).toBe(false);
    expect(campaignDatesBodySchema.safeParse({ votingOpensAt: {} }).success).toBe(false);
  });

  it.each(['not json', '{"ops":[null]}', '{"ops":[42]}', '{"ops":{}}'])(
    'rejects malformed FAQ content: %s',
    (content) => {
      expect(faqItemBodySchema.safeParse({ title: 'Question', content }).success).toBe(false);
    },
  );

  it('accepts FAQ embeds and rejects mixed-type reorder IDs', () => {
    expect(
      faqItemBodySchema.safeParse({
        title: 'Question',
        content: JSON.stringify({
          ops: [{ insert: 'Text\n' }, { insert: { image: 'https://example.com/image.png' } }],
        }),
      }).success,
    ).toBe(true);
    expect(faqReorderBodySchema.safeParse({ order: ['id', null] }).success).toBe(false);
  });
});
