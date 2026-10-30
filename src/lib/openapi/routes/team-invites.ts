import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const teamInvitesRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/team-invites/{token}',
    summary: 'Preview a team invite token',
    description:
      'Returns descriptive metadata about the team invite — candidate name, form title, owning group name, token validity, and current status — so the prospective team member knows what they are agreeing to before accepting or rejecting. Authentication is required; the prospective member must be logged in to respond.\n`formClosed` is true when the form has been soft-deleted or its submission window ([opensAt, closesAt]) has ended. The preview still renders in that case (200) — accept/reject will fail with 400/404 — so the UI can explain why rather than showing a bare error.\n',
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        token: z.string().openapi({
          param: { description: 'Raw (unhashed) team invite token received from the candidate' },
        }),
      }),
    },
    responses: {
      '200': jsonResponse('Invite preview', schemaRef('TeamInvitePreview')),
      '400': { description: 'Missing token parameter' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Invite token not found (invalid or never existed)' },
    },
  },
  {
    method: 'post',
    path: '/api/team-invites/{token}/reject',
    summary: 'Decline a team invite token',
    description:
      "Marks the token as used with response=REJECTED. After this the slot returns to `rejected` state and the candidate may regenerate a fresh invite token for the same slot. The caller must be authenticated and may not be the registration's candidate.\nThe invite's form must still exist (not soft-deleted) and its submission window must still be open — team assembly stops once the form closes, same as new applications.\n",
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        token: z.string().openapi({ param: { description: 'Raw (unhashed) team invite token' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Invite declined', {
        type: 'object',
        required: ['rejected'],
        properties: { rejected: { type: 'boolean', example: true } },
      }),
      '400': {
        description: "Missing token, token has expired, or the form's submission window is closed",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is the registration's candidate (cannot reject own invite)" },
      '404': { description: 'Invite token not found, or its form is soft-deleted' },
      '409': {
        description:
          'Token already used, revoked, or registration no longer accepting team members',
      },
    },
  },
  {
    method: 'post',
    path: '/api/team-invites/{token}/accept',
    summary: 'Accept a team invite token',
    description:
      "Marks the token as used with response=ACCEPTED and records the invitee's identity (userId, fullName, group, faculty). After this the slot enters the `awaiting_candidate` state — the registration's author must then explicitly confirm or decline via PATCH /api/registrations/{id}/team/{slot}/decision. The registration is only auto-promoted to PENDING_REVIEW once the candidate confirms every slot.\nThe caller must be authenticated and may not be the registration's candidate (you cannot accept your own invite). The invite's form must still exist (not soft-deleted) and its submission window must still be open — team assembly stops once the form closes, same as new applications.\n",
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        token: z.string().openapi({ param: { description: 'Raw (unhashed) team invite token' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Invite accepted', {
        type: 'object',
        required: ['accepted', 'registrationStatus'],
        properties: {
          accepted: { type: 'boolean', example: true },
          registrationStatus: {
            type: 'string',
            enum: ['AWAITING_TEAM'],
            description:
              'Always AWAITING_TEAM at this point; promotion to PENDING_REVIEW happens on candidate confirmation.',
          },
        },
      }),
      '400': {
        description:
          "Token expired, form's submission window closed, registration not accepting team members, or any other terminal-state conflict",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: "Caller is the registration's candidate (cannot accept own invite)" },
      '404': { description: 'Invite token not found, or its form is soft-deleted' },
      '409': { description: 'Token already used or revoked' },
    },
  },
  {
    method: 'get',
    path: '/api/registrations/{id}/team',
    summary: 'List team-invite slot statuses for a registration',
    description:
      "Returns one entry per slot (1..team_size) showing the current state and, where applicable, the invitee's identity. Plaintext tokens are never returned here; they are only revealed to the candidate at creation time via POST /api/registrations/{id}/team/{slot}.\nAccessible to the registration's author or any active member of the form's owning ВКСУ group.\nSlot states:\n  - **empty**: no token has ever been issued for this slot.\n  - **pending**: an invite token is outstanding, awaiting the invitee's response.\n  - **rejected**: the invitee declined the invite. Candidate can regenerate.\n  - **expired**: the token expired or was revoked before the invitee responded.\n  - **awaiting_candidate**: the invitee accepted; the candidate must confirm or decline.\n  - **declined**: the candidate decided not to keep the accepted invitee. Candidate can regenerate.\n  - **accepted**: the invitee accepted and the candidate confirmed (terminal; slot is locked).\n",
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Team slot statuses', {
        type: 'object',
        required: ['teamSize', 'slots'],
        properties: {
          teamSize: { type: 'integer', minimum: 0 },
          slots: { type: 'array', items: schemaRef('TeamSlot') },
        },
      }),
      '400': { description: 'Invalid registration UUID' },
      '401': { description: 'Unauthorized' },
      '403': {
        description: 'Caller is neither the registration author nor an active ВКСУ group member',
      },
      '404': { description: 'Registration not found, or its form is soft-deleted' },
    },
  },
  {
    method: 'post',
    path: '/api/registrations/{id}/team/{slot}',
    summary: 'Generate or regenerate the invite token for a team slot',
    description:
      "Creates a fresh invite token for the specified slot and revokes any previously active (unused) token for the same slot. The raw plaintext token is returned exactly once; it is not stored on the server.\nThis endpoint is blocked when:\n  - The slot is in `accepted` state (invitee accepted and candidate\n    confirmed — the slot is locked).\n  - The registration is not in AWAITING_TEAM state.\n  - The form has been soft-deleted, or its submission window\n    ([opensAt, closesAt]) has ended — team assembly stops once the\n    form closes, same as new applications.\n\nOnly the registration's author (candidate) may call this endpoint.\n",
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
        slot: z
          .number()
          .int()
          .min(1)
          .openapi({
            param: {
              description: "Team slot number (1-indexed, must not exceed the form's team_size)",
            },
          }),
      }),
    },
    responses: {
      '200': jsonResponse('Invite token generated – raw token returned here only', {
        type: 'object',
        required: ['slot', 'token', 'expiresAt'],
        properties: {
          slot: { type: 'integer' },
          token: {
            type: 'string',
            description:
              'Raw (unhashed) invite token. Share this with the prospective team member; it is not stored on the server.',
          },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      }),
      '400': {
        description: "Invalid UUID, slot out of range, or the form's submission window is closed",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the registration author' },
      '404': { description: 'Registration not found, or its form is soft-deleted' },
      '409': {
        description:
          'Registration is not in AWAITING_TEAM state, or the slot is already accepted (locked)',
      },
    },
  },
  {
    method: 'patch',
    path: '/api/registrations/{id}/team/{slot}/decision',
    summary: 'Candidate confirms or declines an invitee who already accepted',
    description:
      "After a team member follows their invite link and accepts (state: `awaiting_candidate`), the candidate must explicitly confirm or decline that person via this endpoint.\n- **CONFIRMED**: the slot is locked as accepted. If this was the last\n  outstanding slot, the registration is atomically transitioned from\n  AWAITING_TEAM to PENDING_REVIEW within the same database transaction.\n- **DECLINED**: the slot is freed. The candidate can then regenerate\n  a fresh invite token for the same slot.\n\nThe form must still exist (not soft-deleted) and its submission window must still be open — team assembly stops once the form closes, same as new applications.\nOnly the registration's author (candidate) may call this endpoint.\n",
    tags: ['TeamInvites'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Registration UUID' } }),
        slot: z
          .number()
          .int()
          .min(1)
          .openapi({
            param: {
              description: "Team slot number (1-indexed, must not exceed the form's team_size)",
            },
          }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['decision'],
              properties: { decision: { type: 'string', enum: ['CONFIRMED', 'DECLINED'] } },
            },
          },
        },
      },
    },
    responses: {
      '200': jsonResponse('Decision recorded', {
        type: 'object',
        required: ['slot', 'decision', 'registrationStatus'],
        properties: {
          slot: { type: 'integer' },
          decision: { type: 'string', enum: ['CONFIRMED', 'DECLINED'] },
          registrationStatus: {
            type: 'string',
            enum: ['AWAITING_TEAM', 'PENDING_REVIEW'],
            description:
              "The registration's status after this decision. PENDING_REVIEW only when CONFIRMED and all other slots are also accepted.",
          },
        },
      }),
      '400': {
        description:
          "Invalid UUID, invalid slot, invalid decision value, slot out of range, or the form's submission window is closed",
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Caller is not the registration author' },
      '404': { description: 'Registration not found, or its form is soft-deleted' },
      '409': {
        description:
          'Registration is not in AWAITING_TEAM state, or slot is not in awaiting_candidate state',
      },
    },
  },
];
