import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const candidateRegistrationFormsRoutes: RouteConfig[] = [
  {
    method: 'patch',
    path: '/api/registration-forms/{id}',
    summary: 'Update a candidate registration form',
    description:
      "Replaces all mutable fields on the form. Existing restrictions are hard-deleted and recreated atomically. Caller must be an active ВКСУ member of the form's group. The same validation rules as form creation apply, plus phase-based field locking: before `opensAt`, every field is free to move (a backdated `opensAt` is clamped to now, same as creation); once registration has opened, every field EXCEPT `closesAt` is frozen at its current value, and `closesAt` may only be moved later, never earlier; once `closesAt` has passed, the form is closed and nothing may change at all. Forms owned by an election campaign (`registration_form_id` on the campaign) reject any date change outright — edit those from the campaign's PATCH endpoint instead, so the two can't drift apart.\n",
    tags: ['CandidateRegistrationForms'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z
          .string()
          .openapi({ format: 'uuid', param: { description: 'Registration form UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': { schema: schemaRef('CreateCandidateRegistrationFormBody') },
        },
      },
    },
    responses: {
      '200': jsonResponse(
        'Form updated; returns the full updated form',
        schemaRef('CandidateRegistrationForm'),
      ),
      '400': {
        description:
          "Invalid UUID, body validation error, an attempted change to a field that's locked in the form's current phase, the form is already closed, or an attempted date change on a campaign-owned form\n",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active ВКСУ group member' },
      '404': { description: 'Form not found or soft-deleted' },
    },
  },
  {
    method: 'delete',
    path: '/api/registration-forms/{id}',
    summary: 'Soft-delete a candidate registration form',
    description:
      "Marks the form as deleted. Soft-deleted forms are no longer returned in any listing endpoint. Caller must be an active ВКСУ member of the form's group.\n",
    tags: ['CandidateRegistrationForms'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z
          .string()
          .openapi({ format: 'uuid', param: { description: 'Registration form UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Form soft-deleted' },
      '400': { description: 'Invalid form UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active ВКСУ group member' },
      '404': { description: 'Form not found or already soft-deleted' },
    },
  },
  {
    method: 'get',
    path: '/api/groups/{id}/registration-forms',
    summary: 'List candidate registration forms for a ВКСУ group',
    description:
      'Returns every non-deleted form belonging to the group along with aggregated submission counts (`submittedCount` = all non-draft registrations; `pendingReviewCount` = registrations in PENDING_REVIEW state). Caller must be an active member of the group and the group must be of type VKSU.\n',
    tags: ['CandidateRegistrationForms'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of registration forms with submission counts', {
        type: 'array',
        items: {
          allOf: [
            schemaRef('CandidateRegistrationForm'),
            {
              type: 'object',
              required: ['submittedCount', 'pendingReviewCount'],
              properties: {
                submittedCount: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Total registrations excluding drafts.',
                },
                pendingReviewCount: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Registrations currently awaiting review.',
                },
              },
            },
          ],
        },
      }),
      '400': { description: 'Invalid group UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active member of the ВКСУ group' },
      '404': { description: 'Group not found, soft-deleted, or not of type VKSU' },
    },
  },
  {
    method: 'post',
    path: '/api/groups/{id}/registration-forms',
    summary: 'Create a candidate registration form for a ВКСУ group',
    description:
      "Creates a new candidate registration form within the specified ВКСУ group. Caller must be an active member of the group. The form's restrictions determine which students may submit registrations. If `opensAt` is in the past it is silently clamped to the current time rather than honoured verbatim.\n",
    tags: ['CandidateRegistrationForms'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Group UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': { schema: schemaRef('CreateCandidateRegistrationFormBody') },
        },
      },
    },
    responses: {
      '201': jsonResponse('Form created', {
        allOf: [
          schemaRef('CandidateRegistrationForm'),
          {
            type: 'object',
            required: ['submittedCount', 'pendingReviewCount'],
            properties: {
              submittedCount: { type: 'integer', example: 0 },
              pendingReviewCount: { type: 'integer', example: 0 },
            },
          },
        ],
      }),
      '400': { description: 'Invalid UUID or body validation error' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active ВКСУ group member' },
      '404': { description: 'Group not found, soft-deleted, or not of type VKSU' },
    },
  },
];
