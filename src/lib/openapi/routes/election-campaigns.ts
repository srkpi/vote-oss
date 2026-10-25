import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const electionCampaignsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/groups/{id}/campaigns',
    summary: 'List active election campaigns for a group',
    description:
      'Returns every non-deleted (non-cancelled) election campaign belonging to the group. Any authenticated user may call this endpoint.\n',
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of campaigns (may be empty)', {
        type: 'array',
        items: schemaRef('ElectionCampaign'),
      }),
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Group not found or soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/{id}/campaigns',
    summary: 'Create an election campaign for a ВКСУ group',
    description:
      'Creates a new election campaign for the specified ВКСУ group. The caller must be an active member of the group and the group must be of type VKSU. The campaign starts in the ANNOUNCED state; a cron job advances it through subsequent states based on the configured timestamps. `positionTitle`, `electionKind`, `teamSize`, `requiresCampaignProgram` and `restrictions` are immutable after creation; the phase-boundary timestamps can later be changed via `PATCH /api/campaigns/{id}`, within the limits described there. If `announcedAt` is in the past it is silently clamped to the current time rather than honoured verbatim.\nWhen signatureCollection is true, signaturesOpensAt, signaturesClosesAt, and signatureQuorum are all required.\n',
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('CreateElectionCampaignBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Campaign created', schemaRef('ElectionCampaign')),
      '400': { description: 'Invalid UUID or body validation error' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active ВКСУ group member' },
      '404': { description: 'Group not found, soft-deleted, or not of type VKSU' },
    },
  },
  {
    method: 'get',
    path: '/api/campaigns/{id}',
    summary: 'Get an election campaign by ID',
    description:
      'Returns full campaign details. Any authenticated user may fetch a campaign; group membership is not required for reading.\n',
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Campaign UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Campaign details', schemaRef('ElectionCampaign')),
      '400': { description: 'Invalid campaign UUID' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Campaign not found, soft-deleted, or its group is soft-deleted' },
    },
  },
  {
    method: 'patch',
    path: '/api/campaigns/{id}',
    summary: "Edit a campaign's phase-boundary timestamps",
    description:
      "Changes the campaign's phase-boundary timestamps (announcedAt, registrationClosesAt, signaturesOpensAt, signaturesClosesAt, votingOpensAt, votingClosesAt). No other field can be changed here. Replace-all semantics — send every timestamp, including ones you're not changing (echo back the current value). Caller must be an active member of the campaign's ВКСУ group.\nWhich fields accept a new value depends on the current time versus each boundary:\n  - a boundary already in the past is locked (its stage has already\n    begun and can't be un-started);\n  - the boundary ending the currently in-progress stage may only be\n    moved later (\"extend\", never shortened) — useful for pushing a\n    deadline back if problems come up mid-stage;\n  - every boundary after that (stage not yet begun) is free to move\n    either way.\n`GET`/`POST` responses expose this per-field as `stageEditability`. A campaign that is CANCELLED, FAILED, or COMPLETED can't be edited at all. If a still-editable `announcedAt` is moved into the past it is clamped to the current time, same as creation. Editing a boundary that already has a spawned registration form / signature elections / final election updates those too, so the change actually takes effect.\n",
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Campaign UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('UpdateElectionCampaignDatesBody') } },
      },
    },
    responses: {
      '200': jsonResponse(
        'Campaign updated; returns the full updated campaign',
        schemaRef('ElectionCampaign'),
      ),
      '400': {
        description:
          'Invalid UUID, body validation error, an attempted change to a locked or extend-only boundary, or the campaign is in a terminal state (CANCELLED/FAILED/COMPLETED)\n',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is not an active member of the campaign's ВКСУ group" },
      '404': { description: 'Campaign not found or soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/campaigns/{id}',
    summary: 'Cancel an election campaign (soft-delete, state → CANCELLED)',
    description:
      "Soft-deletes the campaign and transitions its state to CANCELLED. Cancelled campaigns can no longer advance through their state machine. Caller must be an active member of the campaign's ВКСУ group.\n",
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Campaign UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Campaign cancelled' },
      '400': { description: 'Invalid campaign UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is not an active member of the campaign's ВКСУ group" },
      '404': { description: 'Campaign not found or already soft-deleted' },
    },
  },
  {
    method: 'get',
    path: '/api/campaigns/{id}/signature-elections',
    summary: 'List per-candidate signature elections for a campaign',
    description:
      "Returns one summary entry per APPROVED candidate who has an auto-spawned signature election attached to them. Candidates who were not yet approved or whose signature election was not created yet are excluded. Caller must be an active member of the campaign's ВКСУ group.\n",
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Campaign UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of signature election summaries (may be empty)', {
        type: 'array',
        items: schemaRef('CampaignSignatureElectionSummary'),
      }),
      '400': { description: 'Invalid campaign UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is not an active member of the campaign's group" },
      '404': { description: 'Campaign not found, soft-deleted, or its group is soft-deleted' },
    },
  },
  {
    method: 'get',
    path: '/api/campaigns/{id}/final-election',
    summary: "Get the campaign's final election summary",
    description:
      "Returns a summary of the campaign's auto-created final Election, including one choice per qualifying candidate and, once the election is closed, per-choice vote counts.\nReturns `null` (HTTP 200 with a null body) when the final election has not been created yet (e.g. the campaign is still in the pre-voting phase).\nCaller must be an active member of the campaign's ВКСУ group.\n",
    tags: ['ElectionCampaigns'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Campaign UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Final election summary, or null if the election does not exist yet.\n', {
        oneOf: [schemaRef('CampaignFinalElectionSummary'), { type: 'null' }],
      }),
      '400': { description: 'Invalid campaign UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is not an active member of the campaign's group" },
      '404': { description: 'Campaign not found, soft-deleted, or its group is soft-deleted' },
    },
  },
];
