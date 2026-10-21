import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const candidateRegistrationsRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: '/api/registrations/{id}/withdraw',
    summary: 'Withdraw a candidate registration',
    description:
      "Transitions the registration to WITHDRAWN. Only the registration's author (candidate) may withdraw their registration. Withdrawal is allowed from any non-final state: DRAFT, AWAITING_TEAM, or PENDING_REVIEW. Final states (APPROVED, REJECTED, WITHDRAWN) cannot be reverted.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Registration withdrawn', schemaRef('CandidateRegistration')),
      '400': { description: 'Invalid registration UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the registration author' },
      '404': { description: 'Registration not found or its form is soft-deleted' },
      '409': {
        description: 'Registration is already in a final state (APPROVED, REJECTED, or WITHDRAWN)',
      },
    },
  },
  {
    method: 'post',
    path: '/api/registrations/{id}/submit',
    summary: 'Submit a draft registration for review',
    description:
      "Validates all required fields and transitions the registration:\n  - DRAFT → AWAITING_TEAM when the form requires team members\n    (team_size > 0).\n  - DRAFT → PENDING_REVIEW for solo candidacy (team_size = 0).\n\nHard validation at submit time (unlike the lenient draft save):\n  - Phone number must be non-empty and valid.\n  - Telegram tag is optional but must be valid if provided.\n  - Campaign programme URL is required and must be valid if the form\n    has requiresCampaignProgram = true.\n  - The form must be within its open window.\n  - The caller must satisfy the form's eligibility restrictions.\n\nOnly the registration's author may submit it.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse(
        'Registration submitted; returns the updated registration with its new status',
        schemaRef('CandidateRegistration'),
      ),
      '400': {
        description:
          'Invalid UUID, form window closed, required field missing or invalid, or campaign programme URL required but absent.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description:
          "Caller is not the registration author, or does not satisfy the form's restrictions",
      },
      '404': {
        description:
          'Registration not found, form soft-deleted, group not VKSU, or group soft-deleted',
      },
      '409': { description: 'Registration is not in DRAFT state' },
    },
  },
  {
    method: 'post',
    path: '/api/registrations/{id}/reject',
    summary: 'Reject a candidate registration with a mandatory reason',
    description:
      "Transitions the registration from PENDING_REVIEW to REJECTED. A non-empty rejection reason is mandatory and is shown to the candidate. Records the reviewer's identity and the review timestamp. Caller must be an active member of the form's owning ВКСУ group.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: {
                  type: 'string',
                  minLength: 1,
                  description: 'Human-readable reason for the rejection shown to the candidate.',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse('Registration rejected', schemaRef('CandidateRegistration')),
      '400': {
        description: 'Invalid UUID, missing or empty reason, or reason exceeds maximum length',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active member of the owning ВКСУ group' },
      '404': { description: 'Registration not found or its form is soft-deleted' },
      '409': { description: 'Registration is not in PENDING_REVIEW state' },
    },
  },
  {
    method: 'post',
    path: '/api/registrations/{id}/approve',
    summary: 'Approve a candidate registration',
    description:
      "Transitions the registration from PENDING_REVIEW to APPROVED. Records the reviewer's user ID and full name and the review timestamp. Caller must be an active member of the form's owning ВКСУ group.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Registration approved', schemaRef('CandidateRegistration')),
      '400': { description: 'Invalid registration UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active member of the owning ВКСУ group' },
      '404': { description: 'Registration not found or its form is soft-deleted' },
      '409': { description: 'Registration is not in PENDING_REVIEW state' },
    },
  },
  {
    method: 'get',
    path: '/api/registration-forms',
    summary: 'List candidate registration forms the caller may view',
    description:
      "Returns every non-deleted registration form whose owning group is a non-deleted ВКСУ group. Ordered by closes_at ascending so approaching deadlines appear first. Each entry includes:\n- `eligible`: whether the caller satisfies every restriction on the\n  form (used by the UI to indicate ineligible forms without hiding them).\n- `myRegistrationStatus`: the caller's registration status on this form\n  (excluding DRAFT which is private), or null if none exists.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Array of registration form summaries', {
        type: 'array',
        items: {
          allOf: [
            schemaRef('CandidateRegistrationForm'),
            {
              type: 'object',
              required: ['eligible', 'myRegistrationStatus'],
              properties: {
                eligible: { type: 'boolean' },
                myRegistrationStatus: {
                  type: 'string',
                  enum: ['AWAITING_TEAM', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
                  nullable: true,
                  description: "The caller's current non-draft registration status, or null.",
                },
              },
            },
          ],
        },
      }),
      '401': { description: 'Unauthorized' },
    },
  },
  {
    method: 'get',
    path: '/api/registration-forms/{id}',
    summary: 'Get registration form details (candidate-facing)',
    description:
      "Returns the full form details, the caller's existing registration on this form (if any, including draft), and an `eligible` flag derived from the form's restrictions. Any authenticated user may call this endpoint; the `eligible` flag tells the UI whether the user satisfies the restrictions without exposing an error.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z
          .string()
          .openapi({ format: 'uuid', param: { description: 'Registration form UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Form details with caller eligibility and existing registration', {
        allOf: [
          schemaRef('CandidateRegistrationForm'),
          {
            type: 'object',
            required: ['eligible', 'myRegistration'],
            properties: {
              eligible: {
                type: 'boolean',
                description: 'Whether the caller satisfies every restriction on the form.',
              },
              myRegistration: {
                nullable: true,
                allOf: [schemaRef('CandidateRegistration')],
                description: "The caller's existing registration on this form, or null.",
              },
            },
          },
        ],
      }),
      '400': { description: 'Invalid form UUID' },
      '401': { description: 'Unauthorized' },
      '404': {
        description: 'Form not found, soft-deleted, or its group is not VKSU or is soft-deleted',
      },
    },
  },
  {
    method: 'get',
    path: '/api/registration-forms/{id}/registrations',
    summary: 'List registrations submitted to a form (reviewer view)',
    description:
      "Returns every non-draft registration for the form ordered by submission date descending. DRAFT registrations (private to the candidate) are excluded. Caller must be an active member of the form's owning ВКСУ group.\n",
    tags: ['CandidateRegistrations'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z
          .string()
          .openapi({ format: 'uuid', param: { description: 'Registration form UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Array of candidate registrations (may be empty)', {
        type: 'array',
        items: schemaRef('CandidateRegistration'),
      }),
      '400': { description: 'Invalid form UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not an active member of the owning ВКСУ group' },
      '404': { description: 'Form not found or soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/registration-forms/{id}/registrations',
    summary: "Create or update the caller's draft registration for a form",
    description:
      "Idempotent for draft registrations: if the caller already has a DRAFT registration for this form, it is updated in place (200). If no registration exists, a new one is created (201). If a non-draft registration already exists (submitted), the request is rejected (409). Submitting (transitioning out of DRAFT) is done via POST /api/registrations/{id}/submit.\nValidation:\n  - The form must be within its open window (opens_at ≤ now ≤ closes_at).\n  - The caller must satisfy the form's eligibility restrictions.\n  - Non-empty phone and Telegram values are validated on save; blank\n    values are accepted in DRAFT state.\n  - The campaign programme URL (when provided) must be a valid URL.\n",
    tags: ['CandidateRegistrations'],
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
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                phoneNumber: {
                  type: 'string',
                  description: 'Ukrainian phone number. Blank is accepted in draft state.',
                },
                telegramTag: {
                  type: 'string',
                  description:
                    'Telegram username without the leading @. Blank is accepted in draft state.',
                },
                campaignProgramUrl: {
                  type: 'string',
                  nullable: true,
                  description:
                    "URL to the candidate's campaign programme. Required at submission time when requiresCampaignProgram is true.",
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse(
        'Existing draft registration updated',
        schemaRef('CandidateRegistration'),
      ),
      '201': jsonResponse('New draft registration created', schemaRef('CandidateRegistration')),
      '400': {
        description:
          'Invalid UUID, form not yet open, form already closed, or field validation failure',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller does not satisfy the form's eligibility restrictions" },
      '404': { description: 'Form not found or soft-deleted' },
      '409': { description: 'A non-draft registration already exists for this user on this form' },
    },
  },
];
