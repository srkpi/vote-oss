import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse, schemaRef } from '../helpers';
import { z } from '../zod';

export const electionsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/elections',
    summary: 'List elections visible to the caller',
    description:
      'Returns a structured envelope containing elections the caller is eligible to see, filter metadata for dropdown population, and the total count. Ballot counts are served from short-lived real-time Redis counters overlaid on the longer-lived metadata cache.\nFor regular users (non-admin) each election includes a `voteStatus` field: `can_vote`, `voted`, or `cannot_vote`. Admin responses omit `voteStatus` and instead include soft-deletion and permission fields.\nSorting: Regular elections are ordered by `opens_at` descending. Petitions can be sorted by `createdAt` (default) or `votes` via the `sort` query parameter.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        type: z
          .enum(['ALL', 'ELECTION', 'PETITION'])
          .openapi({
            default: 'ELECTION',
            param: { description: 'Filter by election type. Defaults to ELECTION.' },
          })
          .optional(),
        sort: z
          .enum(['createdAt', 'votes'])
          .openapi({
            default: 'createdAt',
            param: {
              description:
                'Petition sort order. Only meaningful when type=PETITION. `votes` sorts by total ballot count descending.\n',
            },
          })
          .optional(),
      }),
    },
    responses: {
      '200': jsonResponse('Elections list response', schemaRef('ElectionsListResponse')),
      '400': { description: 'Invalid type filter value' },
      '401': { description: 'Unauthorized' },
    },
  },
  {
    method: 'post',
    path: '/api/elections',
    summary: 'Create an election or petition',
    description:
      'Creates a new election (admin-only) or petition (any authenticated user). Non-admin users are always routed to the petition code path regardless of the `type` field. Admins with `manage_petitions` have their petitions auto-approved on creation; petitions from other users start unapproved.\nElection-specific behaviour:\n  - An RSA key pair is generated per election. The private key is\n    encrypted with AES-256-GCM before being stored.\n  - FACULTY and GROUP restriction values are validated against the\n    live campus API.\n  - Faculty-restricted admins must include a FACULTY restriction for\n    their own faculty (or at least one GROUP_MEMBERSHIP restriction).\n  - The `anonymous` flag (default true) controls whether voter identity\n    is embedded in ballot envelopes.\n  - The `shuffleChoices` flag is not allowed for single-choice elections.\n  - `publicViewing` defaults to true when no restrictions are set.\n\nPetition-specific behaviour:\n  - All body fields except `title` and `description` are ignored.\n  - A single "Підтримати" choice is seeded automatically.\n  - Petitions are always non-anonymous, publicly viewable, and use a\n    fixed quorum winning condition.\n  - An unapproved petition\'s `closes_at` is set to `created_at` (i.e.\n    it is effectively closed until an admin approves it).\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('ElectionCreateBody') } },
      },
    },
    responses: {
      '201': jsonResponse('Election or petition created', schemaRef('Election')),
      '400': {
        description:
          'Validation error: missing required fields, invalid dates, invalid choice count, invalid restriction type or value, invalid winning conditions, or campus API validation failure.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – non-admin attempting to create a regular election' },
      '500': { description: 'Campus API unavailable during restriction validation' },
    },
  },
  {
    method: 'get',
    path: '/api/elections/{id}',
    summary: 'Get a single election',
    description:
      'Returns full election details including choices, ballot count, and winning conditions.  The `anonymous` field indicates whether voter identities are cryptographically embedded in ballots.  Access is subject to faculty/group eligibility.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Election details', schemaRef('ElectionDetail')),
      '400': { description: 'Invalid UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'User is not eligible for this election' },
      '404': { description: 'Election not found' },
    },
  },
  {
    method: 'delete',
    path: '/api/elections/{id}',
    summary: 'Soft-delete an election',
    description:
      'Marks an election as deleted (sets deleted_at / deleted_by). The election is hidden from non-admin users immediately but remains visible to admins and can be restored. Requires admin authentication. Admins may only delete elections that were created by themselves or a subordinate in the admin hierarchy.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Election deleted' },
      '400': { description: 'Invalid UUID' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – not an admin or election belongs to a different faculty' },
      '404': { description: 'Election not found' },
    },
  },
  {
    method: 'patch',
    path: '/api/elections/{id}',
    summary: 'Update an upcoming election',
    description:
      'Updates the configuration, choices, restrictions, and metadata of an existing election. This operation is restricted to administrators. An election can only be edited if it has not started yet (current time is before `opensAt`) and it is not a petition. The updating admin must have created the election or be an ancestor of the creator in the admin hierarchy. The update completely replaces existing choices and restrictions.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
      body: {
        required: true,
        content: { 'application/json': { schema: schemaRef('ElectionEditBody') } },
      },
    },
    responses: {
      '204': { description: 'Election updated successfully. No content returned.' },
      '400': {
        description:
          'Invalid request. Reason can include: invalid UUID, invalid JSON, missing required fields, malformed dates, violation of choice bounds (min/max constraints), target election is a petition, election has already started, or failed restriction validations (e.g., graduate course constraints, faculty mismatch).\n',
      },
      '401': { description: 'Unauthorized. Session cookie missing or invalid.' },
      '403': {
        description:
          'Forbidden. User is not an admin, or does not have permissions over this election, its faculty scope, or the specified group constraints.\n',
      },
      '404': { description: 'Election not found or has been soft-deleted.' },
    },
  },
  {
    method: 'get',
    path: '/api/elections/{id}/voters',
    summary: 'Decrypted voter list for a non-anonymous election',
    description:
      'Returns the unique list of voter identities (`userId`, `fullName`) extracted by decrypting the v2 ballot envelopes on the server.\nAvailability:\n  - Only for non-anonymous elections (`anonymous: false`). Anonymous\n    elections carry no voter identity; calling this endpoint for them\n    returns 400.\n  - The election must have already opened. Upcoming elections return 400.\n  - Available during both open and closed phases. While the election\n    is open the voter list (without their choices) is returned, since\n    it is essentially public in a non-anonymous context.\n\nAccess rules mirror GET /api/elections/{id}/ballots: unrestricted admins always have access; faculty-restricted admins require a matching FACULTY restriction or publicViewing; regular users must satisfy the restrictions or the election must be publicViewing.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('List of unique voters', {
        type: 'object',
        required: ['voters'],
        properties: {
          voters: {
            type: 'array',
            items: {
              type: 'object',
              required: ['userId', 'fullName'],
              properties: { userId: { type: 'string' }, fullName: { type: 'string' } },
            },
          },
        },
      }),
      '400': {
        description: 'Invalid UUID, election is anonymous, or election has not started yet.\n',
      },
      '401': { description: 'Unauthorized' },
      '403': {
        description: 'Caller is not eligible to view this election and publicViewing is false',
      },
      '404': {
        description: 'Election not found (non-admins also receive 404 for soft-deleted elections)',
      },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/token',
    summary: 'Request a vote token',
    description:
      "Issues a one-time, signed vote token to the authenticated user for the specified open election. Enforces faculty/group eligibility and prevents issuing more than one token per user per election.\nAfter issuing the token the user's voted-elections cache is updated so the elections list page immediately reflects the new `voted` status without a DB round-trip on the next list request.\nFor non-anonymous elections the response also includes a `voterIdentity` object that the client must embed inside the v2 ballot envelope.\n",
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Vote token issued', {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'Unique vote token to be used when submitting a ballot',
          },
          signature: {
            type: 'string',
            description: 'ECDSA signature of the token, verifiable with the election public key',
          },
          voterIdentity: {
            type: 'object',
            nullable: true,
            description:
              'Present only when the election is non-anonymous. Must be embedded in the v2 ballot envelope.\n',
            required: ['userId', 'fullName'],
            properties: { userId: { type: 'string' }, fullName: { type: 'string' } },
          },
        },
      }),
      '400': { description: 'Invalid UUID or election not open' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'User not eligible' },
      '404': { description: 'Election not found' },
      '409': { description: 'Token already issued' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/restore',
    summary: 'Restore a soft-deleted election',
    description:
      'Clears the deleted_at and deleted_by fields, making the election visible to users again. Requires admin authentication. Admins may restore a deleted election only if they deleted it themselves or are an ancestor in the admin hierarchy of the admin who deleted it.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '204': { description: 'Election restored' },
      '400': { description: 'Invalid UUID or election is not deleted' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – not an admin or insufficient hierarchy' },
      '404': { description: 'Election not found' },
    },
  },

  {
    method: 'get',
    path: '/api/elections/{id}/ballots',
    summary: 'List all ballots for an election',
    description:
      "Returns the full ordered ballot chain for the given election together with complete election metadata. The `anonymous` field on the returned election indicates whether voter identities are embedded in ballots. When `anonymous` is false, decrypting ballots on the client will reveal each voter's `userId` and `fullName`.\nThe private key is included in the response (`privateKey` on the election object) once the election is closed, or — for non-anonymous elections — while voting is still live (since non-anonymous elections carry no zero-knowledge guarantee to preserve).\nAccess rules mirror GET /api/elections/{id}/ballots: unrestricted admins always have access; faculty-restricted admins require a matching FACULTY restriction or publicViewing; regular users must satisfy the election's restrictions or the election must be publicViewing.\n",
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Election metadata and ordered ballot chain', {
        type: 'object',
        required: ['election', 'ballots'],
        properties: {
          election: schemaRef('ElectionForBallotsResponse'),
          ballots: { type: 'array', items: schemaRef('Ballot') },
        },
      }),
      '400': { description: 'Invalid election UUID' },
      '401': { description: 'Unauthorized' },
      '403': {
        description: 'Caller is not eligible to view this election and publicViewing is false',
      },
      '404': {
        description: 'Election not found (non-admins also receive 404 for soft-deleted elections)',
      },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/ballot',
    summary: 'Cast a ballot in an election',
    description:
      "Submits an encrypted ballot for an open election. The endpoint verifies the vote token signature, checks that the nullifier has not been used before (replay protection), decrypts the ballot to validate the selected choice(s), and appends the ballot to the hash chain.\nAfter the ballot is persisted the live ballot counter in Redis is incremented via INCR — the elections metadata cache is NOT invalidated, so concurrent reads continue to be served from cache without a DB round-trip.  The live counter expires after CACHE_TTL_ELECTION_VOTE_COUNT_SECS and falls back to the ballotCount stored in the metadata cache.\nFor non-anonymous elections the ballot must be encoded as a v2 envelope containing the voter's userId and fullName.  The server validates that the embedded voterId matches the authenticated caller. This ensures voters cannot impersonate others in identified elections.\nRequires any authenticated user.\n",
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Election UUID' } }),
      }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'signature', 'encryptedBallot', 'nullifier'],
              properties: {
                token: {
                  type: 'string',
                  description: 'Vote token issued by POST /api/elections/{id}/token',
                },
                signature: { type: 'string', description: 'ECDSA signature of the vote token' },
                encryptedBallot: { type: 'string', description: 'RSA-encrypted choice ID' },
                nullifier: {
                  type: 'string',
                  description: 'SHA-256 hash of the vote token (prevents double-voting)',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '201': jsonResponse('Ballot recorded', {
        type: 'object',
        required: ['ballotHash'],
        properties: {
          ballotHash: {
            type: 'string',
            description: 'Current hash in the ballot chain for this ballot',
          },
        },
      }),
      '400': { description: 'Validation error' },
      '401': { description: 'Unauthorized' },
      '404': { description: 'Election not found' },
      '409': { description: 'Vote token already used' },
    },
  },
  {
    method: 'post',
    path: '/api/elections/{id}/approve',
    summary: 'Approve a pending petition',
    description:
      'Approves an unapproved petition, making it immediately open for signatures. Only admins with `manage_petitions` may call this endpoint. Regular elections cannot be approved via this endpoint — they are auto-approved on creation.\nOn approval:\n  - `approved` is set to true.\n  - `approved_by_id` and `approved_by_full_name` are recorded.\n  - `opens_at` is reset to the current timestamp.\n  - `closes_at` is set to `opens_at` + 1 calendar month (via\n    `computePetitionClosesAt`).\n\nThe elections metadata cache is invalidated after the update.\n',
    tags: ['Elections'],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({
        id: z.string().openapi({ format: 'uuid', param: { description: 'Petition UUID' } }),
      }),
    },
    responses: {
      '200': jsonResponse('Petition approved', schemaRef('ApprovedPetitionResponse')),
      '400': {
        description:
          'Invalid UUID, the resource is not a petition, or the petition is already approved',
      },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – caller is not an admin with manage_petitions' },
      '404': { description: 'Petition not found or soft-deleted' },
    },
  },
];
