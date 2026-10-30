import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const protocolsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/protocols/{id}',
    summary: 'Get protocol details including computed counts and vote totals',
    description:
      "Returns full protocol details including agenda items, attendance, and responsibles. Also includes:\n- `counts`: quorum-related aggregate (`total`, `present`, `quorum`). - `agendaVoteTotals`: per-agenda-item yes/no/abstain vote totals\n  derived from the linked election's choice mappings. Null for items\n  without a linked election or mapping.\n- `isOwner`: whether the authenticated caller is the group owner.\nAny authenticated user may view any non-deleted protocol of any non-deleted group.\n",
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Protocol UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Protocol details with computed counts and vote totals', {
        allOf: [
          schemaRef('Protocol'),
          {
            type: 'object',
            required: ['counts', 'agendaVoteTotals', 'isOwner'],
            properties: {
              counts: schemaRef('ProtocolComputedCounts'),
              agendaVoteTotals: {
                type: 'object',
                additionalProperties: {
                  oneOf: [
                    {
                      type: 'object',
                      required: ['yes_count', 'no_count', 'not_decided_count'],
                      properties: {
                        yes_count: { type: 'integer' },
                        no_count: { type: 'integer' },
                        not_decided_count: { type: 'integer' },
                      },
                    },
                    { type: 'null' },
                  ],
                },
                description:
                  'Keyed by agenda item UUID. Null for items without a linked election or choice mapping.\n',
              },
              isOwner: { type: 'boolean' },
            },
          },
        ],
      }),
      '400': { description: 'Invalid protocol UUID' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Protocol not found, soft-deleted, or its group is soft-deleted' },
    },
  },
  {
    method: 'put',
    path: '/api/protocols/{id}',
    summary: "Replace a protocol's contents",
    description:
      'Replaces the entire protocol — all fields including agenda items. The existing agenda items are hard-deleted and recreated. Only the group owner may update a protocol. The same election linking constraints as POST /api/groups/{id}/protocols apply.\n',
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Protocol UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CreateProtocolBody') } },
      },
    },
    responses: {
      '200': jsonResponse(
        'Protocol updated; returns the full updated protocol with computed counts',
        {
          allOf: [
            schemaRef('Protocol'),
            {
              type: 'object',
              required: ['counts', 'isOwner'],
              properties: {
                counts: schemaRef('ProtocolComputedCounts'),
                isOwner: { type: 'boolean' },
              },
            },
          ],
        },
      ),
      '400': {
        description:
          'Invalid UUID, body validation error, or election linking constraint violation',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Protocol not found, soft-deleted, or its group is soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/protocols/{id}',
    summary: 'Soft-delete a protocol',
    description:
      'Marks the protocol as deleted. Only the group owner may delete a protocol. Soft-deleted protocols are not returned in the list endpoint.\n',
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Protocol UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Protocol soft-deleted' },
      '400': { description: 'Invalid protocol UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Protocol not found, soft-deleted, or its group is soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/protocols/{id}/generate',
    summary: 'Generate the protocol PDF via the external document generator',
    description:
      "Calls the external KPI docs generator service with the full protocol payload and streams the resulting PDF binary directly to the client. No PDF is stored on this server; each call produces a fresh render. Any authenticated user may generate the PDF for a non-deleted protocol.\nThe endpoint performs a pre-flight check and returns 400 if:\n  - The group's requisites are incomplete (all four fields — name,\n    address, email, contact — must be non-null).\n  - The protocol has no responsibles.\n  - The protocol has no agenda items.\n",
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Protocol UUID' } }),
      }),
    },
    responses: {
      '200': {
        description: 'PDF binary stream',
        content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
        headers: {
          'Content-Disposition': {
            description: 'Attachment filename derived from the protocol number and date.',
            schema: { type: 'string' },
          },
        },
      },
      '400': {
        description:
          'Invalid UUID, group requisites incomplete, no responsibles, or no agenda items.\n',
      },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Protocol not found, soft-deleted, or its group is soft-deleted' },
      '502': {
        description:
          'Failed to contact the external document generator or the generator returned an error',
      },
    },
  },
  {
    method: 'get',
    path: '/api/groups/{id}/protocols',
    summary: 'List protocols for a group',
    description:
      'Returns summaries of all non-deleted protocols belonging to the group, ordered by date descending then number descending. Any authenticated user may access protocols for any non-deleted group. When the optional `nextNumberForYear` query parameter is provided, the response includes an additional `nextNumber` field containing the next sequential protocol number for that calendar year.\n',
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      query: z.object({
        nextNumberForYear: z
          .number()
          .int()
          .min(1900)
          .max(9999)
          .openapi({
            param: {
              description:
                'When provided, the response changes shape to include a `protocols` array, `nextNumber` (the next sequential number for the given year), and the `year` echoed back. Without this parameter the response is a bare array of protocol summaries.\n',
            },
          })
          .optional(),
      }),
    },
    responses: {
      '200': jsonResponse(
        'Protocol summaries (bare array, or object with protocols + nextNumber + year)',
        {
          oneOf: [
            { type: 'array', items: schemaRef('ProtocolSummary') },
            {
              type: 'object',
              required: ['protocols', 'nextNumber', 'year'],
              properties: {
                protocols: { type: 'array', items: schemaRef('ProtocolSummary') },
                nextNumber: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Next available sequential protocol number for the given year.',
                },
                year: {
                  type: 'integer',
                  description: 'The year echoed back from the query parameter.',
                },
              },
            },
          ],
        },
      ),
      '400': { description: 'Invalid group UUID or invalid nextNumberForYear value' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/{id}/protocols',
    summary: 'Create a protocol for a group',
    description:
      "Creates a new meeting protocol for the group. Only the group owner may create protocols. The group's current requisites (fullName, address, email, contact) are captured as a snapshot at creation time via `ossSnapshotOverride` (partial override) or the live group values.\nAgenda items with a linked `electionId` must satisfy these constraints:\n  - The election must have a GROUP_MEMBERSHIP restriction for this group.\n  - The election must already be closed.\n  - The election must have exactly the required number of choices\n    (configured by PROTOCOL_REQUIRED_ELECTION_CHOICES).\n  - When `choiceMapping` is provided, every choice in the election\n    must be mapped to yes/no/abstain.\n",
    tags: ['Protocols'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CreateProtocolBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Protocol created', schemaRef('Protocol')),
      '400': {
        description:
          'Invalid UUID, body validation error, or a linked election fails the group/closed/choice-count/mapping constraints.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the group owner' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
];
