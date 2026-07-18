import fs from 'fs';
import { createSwaggerSpec } from 'next-swagger-doc';
import path from 'path';

import {
  BYPASS_TOKEN_MAX_USAGE_MAX,
  ELECTION_CHOICE_MAX_LENGTH,
  ELECTION_CHOICES_MAX,
  ELECTION_CHOICES_MIN,
  ELECTION_MAX_CHOICES_MAX,
  ELECTION_MIN_CHOICES_MIN,
  ELECTION_TITLE_MAX_LENGTH,
  FAQ_CATEGORY_TITLE_MAX_LENGTH,
  FAQ_ITEM_CONTENT_MAX_LENGTH,
  FAQ_ITEM_TITLE_MAX_LENGTH,
  INVITE_TOKEN_MAX_USAGE_MAX,
  INVITE_TOKEN_MAX_USAGE_MIN,
  INVITE_TOKEN_MAX_VALID_DAYS,
  WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
  WINNING_CONDITION_PERCENTAGE_MIN,
  WINNING_CONDITION_QUORUM_MAX,
  WINNING_CONDITION_QUORUM_MIN,
  WINNING_CONDITION_VOTES_MAX,
  WINNING_CONDITION_VOTES_MIN,
} from '../src/lib/constants';

const spec = createSwaggerSpec({
  apiFolder: 'src/app/api',
  definition: {
    openapi: '3.0.0',
    info: {
      title: process.env.NEXT_PUBLIC_APP_NAME ?? 'Vote OSS',
      version: process.env.npm_package_version || '1.0.0',
    },

    components: {
      securitySchemes: {
        /**
         * Standard session auth – the access JWT is stored in an HTTP-only
         * cookie set by POST /api/auth/kpi-id (or /api/auth/refresh).
         * Browsers send it automatically; API clients must include
         * `credentials: 'include'` (fetch) or `withCredentials: true` (axios).
         */
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
        },

        /**
         * Secret used to protect cron job endpoints from public invocation.
         * Pass as:  Authorization: Bearer <CRON_SECRET>
         */
        cronSecret: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'opaque',
        },
      },

      schemas: {
        // ──────────────────────────────────────────────────────────────────
        // Generic / shared
        // ──────────────────────────────────────────────────────────────────
        UserRef: {
          type: 'object',
          description: 'Minimal user reference embedded in other resources.',
          required: ['userId', 'fullName', 'avatarUrl'],
          properties: {
            userId: { type: 'string' },
            fullName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
          },
        },

        Error: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: {
              type: 'string',
              description: 'Machine-readable error code.',
              example: 'Forbidden',
            },
            message: {
              type: 'string',
              description: 'Human-readable description.',
              example: 'You do not have permission to perform this action.',
            },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Files
        // ──────────────────────────────────────────────────────────────────
        FileSummary: {
          type: 'object',
          description: 'Lightweight representation of an uploaded file.',
          required: ['id', 'url', 'mimeType', 'byteSize', 'uploadedBy', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', description: 'Public URL of the object in the storage bucket.' },
            mimeType: { type: 'string', example: 'image/png' },
            byteSize: { type: 'integer', minimum: 0 },
            originalName: { type: 'string', nullable: true },
            uploadedBy: { type: 'string', description: 'User ID of the uploader.' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Admins
        // ──────────────────────────────────────────────────────────────────
        Admin: {
          type: 'object',
          description: 'An active (non-deleted) admin record.',
          required: [
            'userId',
            'fullName',
            'avatarUrl',
            'group',
            'faculty',
            'promotedAt',
            'manageAdmins',
            'manageGroups',
            'managePetitions',
            'manageFaq',
            'restrictedToFaculty',
          ],
          properties: {
            userId: {
              type: 'string',
              description: 'Unique identifier matching the KPI-ID subject claim.',
            },
            fullName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            group: { type: 'string' },
            faculty: { type: 'string' },
            promoter: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/UserRef' }],
              description: 'Admin who promoted this user; null for the root admin.',
            },
            promotedAt: { type: 'string', format: 'date-time' },
            manageAdmins: {
              type: 'boolean',
              description: 'Whether this admin can invite / remove other admins.',
            },
            manageGroups: {
              type: 'boolean',
              description: 'Whether this admin can create and manage groups.',
            },
            managePetitions: {
              type: 'boolean',
              description: 'Whether this admin can approve / delete petitions.',
            },
            manageFaq: {
              type: 'boolean',
              description: 'Whether this admin can manage FAQ categories and items.',
            },
            restrictedToFaculty: {
              type: 'boolean',
              description:
                'When true the admin can only see and manage resources scoped to their own faculty.',
            },
          },
        },

        InviteTokenCreateBody: {
          type: 'object',
          required: ['validDue'],
          properties: {
            maxUsage: {
              type: 'integer',
              minimum: INVITE_TOKEN_MAX_USAGE_MIN,
              maximum: INVITE_TOKEN_MAX_USAGE_MAX,
              description: 'Maximum number of times the token can be used. Defaults to 1.',
            },
            manageAdmins: {
              type: 'boolean',
              description:
                'Whether redeeming this token grants the manage_admins permission. Caller must already have manage_admins to set this.',
            },
            manageGroups: {
              type: 'boolean',
              description:
                'Whether redeeming this token grants the manage_groups permission. Caller must already have manage_groups to set this.',
            },
            managePetitions: {
              type: 'boolean',
              description:
                'Whether redeeming this token grants the manage_petitions permission. Caller must already have manage_petitions to set this.',
            },
            manageFaq: {
              type: 'boolean',
              description:
                'Whether redeeming this token grants the manage_faq permission. Caller must already have manage_faq to set this.',
            },
            restrictedToFaculty: {
              type: 'boolean',
              description:
                "Whether the invited admin will be restricted to the creator's faculty. Always forced to true when the creator is faculty-restricted.",
            },
            validDue: {
              type: 'string',
              format: 'date-time',
              description: `Expiry timestamp; must be in the future and within ${INVITE_TOKEN_MAX_VALID_DAYS} days.`,
            },
          },
        },

        InviteToken: {
          type: 'object',
          description: 'A non-expired, non-exhausted admin invite token visible to the caller.',
          required: [
            'tokenHash',
            'maxUsage',
            'currentUsage',
            'manageAdmins',
            'manageGroups',
            'managePetitions',
            'manageFaq',
            'restrictedToFaculty',
            'validDue',
            'createdAt',
            'creator',
            'isOwn',
            'deletable',
          ],
          properties: {
            tokenHash: {
              type: 'string',
              description: 'SHA-256 hex digest of the raw token; used as the resource ID.',
            },
            maxUsage: {
              type: 'integer',
              minimum: INVITE_TOKEN_MAX_USAGE_MIN,
              maximum: INVITE_TOKEN_MAX_USAGE_MAX,
            },
            currentUsage: { type: 'integer', minimum: 0 },
            manageAdmins: { type: 'boolean' },
            manageGroups: { type: 'boolean' },
            managePetitions: { type: 'boolean' },
            manageFaq: { type: 'boolean' },
            restrictedToFaculty: { type: 'boolean' },
            validDue: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            creator: { $ref: '#/components/schemas/UserRef' },
            isOwn: {
              type: 'boolean',
              description: 'True when the token was created by the calling admin.',
            },
            deletable: {
              type: 'boolean',
              description:
                'True when the calling admin owns the token or is a transitive ancestor of the creator.',
            },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Elections – shared types
        // ──────────────────────────────────────────────────────────────────
        WinningCondition: {
          type: 'object',
          description:
            'All four conditions are ANDed. Only choices satisfying every enabled condition win. Ties are all marked as winners.',
          properties: {
            hasMostVotes: {
              type: 'boolean',
              description: 'Choice must have the maximum vote count.',
            },
            reachesPercentage: {
              type: 'number',
              nullable: true,
              minimum: WINNING_CONDITION_PERCENTAGE_MIN,
              maximum: WINNING_CONDITION_PERCENTAGE_MAX_EXCLUSIVE,
              description: 'votes / totalBallots * 100 must be strictly greater than this value.',
            },
            reachesVotes: {
              type: 'integer',
              nullable: true,
              minimum: WINNING_CONDITION_VOTES_MIN,
              maximum: WINNING_CONDITION_VOTES_MAX,
              description: 'Choice must have at least this many absolute votes.',
            },
            quorum: {
              type: 'integer',
              nullable: true,
              minimum: WINNING_CONDITION_QUORUM_MIN,
              maximum: WINNING_CONDITION_QUORUM_MAX,
              description:
                'Total ballots cast must be at least this number; if not met no choice wins regardless of other conditions.',
            },
          },
        },

        ElectionChoiceCreateBody: {
          type: 'object',
          required: ['id', 'choice', 'position'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            choice: { type: 'string', minLength: 1, maxLength: ELECTION_CHOICE_MAX_LENGTH },
            position: { type: 'integer', minimum: 0 },
          },
        },

        ElectionChoiceResponse: {
          allOf: [
            { $ref: '#/components/schemas/ElectionChoiceCreateBody' },
            {
              type: 'object',
              properties: {
                votes: {
                  type: 'integer',
                  minimum: 0,
                  description: 'Present only for closed elections or live non-anonymous elections.',
                },
                winner: {
                  type: 'boolean',
                  description: 'Present only for closed elections or live non-anonymous elections.',
                },
              },
            },
          ],
        },

        ElectionType: {
          type: 'string',
          enum: ['ELECTION', 'PETITION'],
        },

        ElectionStatus: {
          type: 'string',
          enum: ['upcoming', 'open', 'closed'],
        },

        ElectionVoteStatus: {
          type: 'string',
          enum: ['can_vote', 'voted', 'cannot_vote'],
          description:
            'Participation status for the authenticated regular user. Only present in elections list responses for non-admin users.',
        },

        ElectionRestrictionType: {
          type: 'string',
          enum: [
            'FACULTY',
            'GROUP',
            'SPECIALITY',
            'STUDY_YEAR',
            'STUDY_FORM',
            'LEVEL_COURSE',
            'BYPASS_REQUIRED',
            'GROUP_MEMBERSHIP',
          ],
        },

        ElectionRestriction: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { $ref: '#/components/schemas/ElectionRestrictionType' },
            value: { type: 'string' },
          },
        },

        ElectionRestrictedGroup: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Elections – request / response bodies
        // ──────────────────────────────────────────────────────────────────

        ElectionEditBody: {
          type: 'object',
          required: ['title', 'opensAt', 'closesAt', 'choices'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: ELECTION_TITLE_MAX_LENGTH },
            description: { type: 'string', nullable: true },
            opensAt: {
              type: 'string',
              format: 'date-time',
              description: 'Ignored for petitions; server sets opens_at on approval.',
            },
            closesAt: {
              type: 'string',
              format: 'date-time',
              description: 'Ignored for petitions; server sets closes_at on approval.',
            },
            choices: {
              type: 'array',
              description:
                'Array of choice label strings. Ignored for petitions (server seeds a single support choice).',
              items: { type: 'string', minLength: 1, maxLength: ELECTION_CHOICE_MAX_LENGTH },
              minItems: ELECTION_CHOICES_MIN,
              maxItems: ELECTION_CHOICES_MAX,
            },
            minChoices: {
              type: 'integer',
              minimum: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
              description: 'Minimum number of choices a voter must select. Defaults to 1.',
            },
            maxChoices: {
              type: 'integer',
              minimum: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
              description:
                'Maximum number of choices a voter may select. Must be >= minChoices and <= number of choices.',
            },
            shuffleChoices: {
              type: 'boolean',
              description:
                'When true, choices are presented in a deterministic per-user random order. Not allowed for single-choice elections.',
            },
            publicViewing: {
              type: 'boolean',
              description:
                'When true, any authenticated user can view the election regardless of restrictions. Defaults to true when no restrictions are set.',
            },
            anonymous: {
              type: 'boolean',
              description:
                "When true (default), voter identity is not embedded in ballot envelopes. When false, each ballot cryptographically encodes the voter's userId and fullName, which are revealed when the election closes.",
            },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionRestriction' },
            },
            winningConditions: { $ref: '#/components/schemas/WinningCondition' },
          },
        },

        ElectionCreateBody: {
          allOf: [
            {
              type: 'object',
              properties: {
                type: { $ref: '#/components/schemas/ElectionType' },
              },
            },
            { $ref: '#/components/schemas/ElectionEditBody' },
          ],
        },

        Election: {
          allOf: [
            { $ref: '#/components/schemas/ElectionCreateBody' },
            {
              type: 'object',
              required: [
                'id',
                'type',
                'createdAt',
                'minChoices',
                'maxChoices',
                'shuffleChoices',
                'publicViewing',
                'anonymous',
                'restrictions',
                'winningConditions',
                'status',
                'createdBy',
                'approved',
                'ballotCount',
                'choices',
              ],
              properties: {
                id: { type: 'string', format: 'uuid' },
                type: { $ref: '#/components/schemas/ElectionType' },
                createdAt: { type: 'string', format: 'date-time' },
                status: { $ref: '#/components/schemas/ElectionStatus' },
                createdBy: { $ref: '#/components/schemas/UserRef' },
                approved: { type: 'boolean' },
                approvedBy: {
                  allOf: [{ $ref: '#/components/schemas/UserRef' }],
                  nullable: true,
                },
                approvedAt: { type: 'string', format: 'date-time', nullable: true },
                ballotCount: { type: 'integer', minimum: 0 },
                winningConditions: { $ref: '#/components/schemas/WinningCondition' },
                shuffleChoices: { type: 'boolean' },
                publicViewing: { type: 'boolean' },
                anonymous: { type: 'boolean' },
                choices: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ElectionChoiceResponse' },
                  minItems: ELECTION_CHOICES_MIN,
                  maxItems: ELECTION_CHOICES_MAX,
                },
                voteStatus: {
                  allOf: [{ $ref: '#/components/schemas/ElectionVoteStatus' }],
                  description:
                    'Only present for regular-user responses from the elections list endpoint. Absent for admin responses and the election detail endpoint.',
                },
                restrictedGroups: {
                  type: 'array',
                  nullable: true,
                  items: { $ref: '#/components/schemas/ElectionRestrictedGroup' },
                  description:
                    'Resolved group names for GROUP_MEMBERSHIP restrictions. Only present on the election detail endpoint.',
                },
                // Admin-only fields (absent for regular users)
                editedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  description: 'Only present for admin-authenticated responses.',
                },
                editedBy: {
                  nullable: true,
                  allOf: [{ $ref: '#/components/schemas/UserRef' }],
                  description: 'Only present for admin-authenticated responses.',
                },
                deletedAt: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                  description: 'Only present for admin-authenticated responses.',
                },
                deletedBy: {
                  nullable: true,
                  allOf: [{ $ref: '#/components/schemas/UserRef' }],
                  description: 'Only present for admin-authenticated responses.',
                },
                canEdit: {
                  type: 'boolean',
                  description: 'Only present for admin-authenticated responses.',
                },
                canDelete: {
                  type: 'boolean',
                  description: 'Only present for admin-authenticated responses.',
                },
                canRestore: {
                  type: 'boolean',
                  description: 'Only present for admin-authenticated responses.',
                },
              },
            },
          ],
        },

        /** Returned by GET /api/elections/[id] */
        ElectionDetail: {
          allOf: [
            { $ref: '#/components/schemas/Election' },
            {
              type: 'object',
              required: ['publicKey', 'bypassedTypes'],
              properties: {
                publicKey: { type: 'string', description: 'PEM-encoded RSA public key.' },
                privateKey: {
                  type: 'string',
                  description:
                    'PEM-encoded RSA private key. Present once the election is closed, or for non-anonymous elections while voting is live.',
                },
                bypassedTypes: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ElectionRestrictionType' },
                  description:
                    'Restriction types that the authenticated user bypasses via an active bypass token.',
                },
                hasVoted: {
                  type: 'boolean',
                  description:
                    'Only present while the election is open. True if the caller has already been issued a vote token.',
                },
              },
            },
          ],
        },

        ApprovedPetitionResponse: {
          type: 'object',
          description: 'Returned by POST /api/elections/{id}/approve after a petition is approved.',
          required: [
            'id',
            'approved',
            'approvedBy',
            'approvedAt',
            'opensAt',
            'closesAt',
            'createdBy',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            approved: { type: 'boolean', example: true },
            approvedBy: { $ref: '#/components/schemas/UserRef' },
            approvedAt: { type: 'string', format: 'date-time' },
            opensAt: {
              type: 'string',
              format: 'date-time',
              description: 'Reset to the approval timestamp.',
            },
            closesAt: {
              type: 'string',
              format: 'date-time',
              description: 'Set to approvedAt + 1 calendar month.',
            },
            createdBy: { $ref: '#/components/schemas/UserRef' },
          },
        },

        ElectionForBallotsResponse: {
          type: 'object',
          description:
            'Election metadata returned alongside the ballot chain from GET /api/elections/{id}/ballots.',
          required: [
            'id',
            'title',
            'status',
            'ballotCount',
            'deletedAt',
            'choices',
            'shuffleChoices',
            'publicViewing',
            'anonymous',
            'minChoices',
            'maxChoices',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', minLength: 1, maxLength: ELECTION_TITLE_MAX_LENGTH },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/ElectionStatus' },
            ballotCount: { type: 'integer', minimum: 0 },
            deletedAt: { type: 'string', nullable: true, format: 'date-time' },
            shuffleChoices: { type: 'boolean' },
            publicViewing: { type: 'boolean' },
            anonymous: {
              type: 'boolean',
              description:
                "When false, decrypting ballots on the client will reveal each voter's userId and fullName.",
            },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionChoiceCreateBody' },
              minItems: ELECTION_CHOICES_MIN,
              maxItems: ELECTION_CHOICES_MAX,
            },
            minChoices: {
              type: 'integer',
              minimum: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
            },
            maxChoices: {
              type: 'integer',
              minimum: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
            },
            privateKey: {
              type: 'string',
              description:
                'PEM-encoded RSA private key. Present once the election is closed, or for non-anonymous elections while voting is live.',
            },
          },
        },

        ElectionsFilterMeta: {
          type: 'object',
          required: ['faculties', 'studyForms'],
          properties: {
            faculties: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Unique faculty codes present in FACULTY restrictions across all elections visible to the caller, sorted alphabetically.',
            },
            studyForms: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Unique study-form values present in STUDY_FORM restrictions across all elections visible to the caller.',
            },
          },
        },

        ElectionsListResponse: {
          type: 'object',
          required: ['elections', 'total', 'meta'],
          properties: {
            elections: {
              type: 'array',
              items: { $ref: '#/components/schemas/Election' },
            },
            total: {
              type: 'integer',
              description:
                'Total number of elections in the response after all visibility and type filtering.',
            },
            meta: { $ref: '#/components/schemas/ElectionsFilterMeta' },
          },
        },

        Ballot: {
          type: 'object',
          required: ['id', 'encryptedBallot', 'createdAt', 'signature', 'currentHash'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            encryptedBallot: {
              type: 'string',
              description:
                'Base64-encoded RSA-encrypted ballot payload (v1: single choice ID; v2: JSON envelope with voter identity for non-anonymous elections).',
            },
            createdAt: { type: 'string', format: 'date-time' },
            signature: {
              type: 'string',
              description: 'RSA-PSS signature over (electionId + encryptedBallot + previousHash).',
            },
            previousHash: {
              type: 'string',
              nullable: true,
              description: 'SHA-256 hash of the preceding ballot entry; null for the first ballot.',
            },
            currentHash: {
              type: 'string',
              description: 'SHA-256 hash of this ballot entry – forms the append-only chain.',
            },
          },
        },

        TallyResult: {
          type: 'object',
          required: ['choiceId', 'choice', 'position', 'votes'],
          properties: {
            choiceId: { type: 'string', format: 'uuid' },
            choice: { type: 'string' },
            position: { type: 'integer' },
            votes: { type: 'integer', minimum: 0 },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Bypass tokens
        // ──────────────────────────────────────────────────────────────────
        BypassTokensCommonFields: {
          type: 'object',
          required: [
            'tokenHash',
            'currentUsage',
            'createdAt',
            'deletedAt',
            'deletedBy',
            'creator',
            'usages',
            'canDelete',
            'canRevokeUsages',
          ],
          properties: {
            tokenHash: {
              type: 'string',
              description: 'SHA-256 hex digest of the raw token.',
            },
            currentUsage: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            deletedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'Non-null when the token has been soft-deleted. Soft-deleted tokens no longer grant access but remain visible for audit.',
            },
            deletedBy: {
              type: 'object',
              nullable: true,
              properties: {
                userId: { type: 'string' },
                fullName: { type: 'string' },
              },
            },
            creator: {
              type: 'object',
              required: ['userId', 'fullName'],
              properties: {
                userId: { type: 'string' },
                fullName: { type: 'string' },
              },
            },
            usages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'userId', 'usedAt'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  userId: { type: 'string' },
                  usedAt: { type: 'string', format: 'date-time' },
                  revokedAt: {
                    type: 'string',
                    format: 'date-time',
                    nullable: true,
                  },
                  revokedBy: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      userId: { type: 'string' },
                      fullName: { type: 'string' },
                    },
                  },
                },
              },
            },
            canDelete: {
              type: 'boolean',
              description:
                'True if the current admin created the token or is a transitive ancestor of the creator in the admin hierarchy, and the token is not already soft-deleted.',
            },
            canRevokeUsages: {
              type: 'boolean',
              description: 'True if the token is not soft-deleted.',
            },
          },
        },

        GlobalBypassTokenCreateBody: {
          type: 'object',
          required: ['maxUsage', 'validUntil'],
          properties: {
            bypassNotStudying: {
              type: 'boolean',
              description:
                'Allow users whose campus status is not "Studying" to access the platform.',
            },
            bypassGraduate: {
              type: 'boolean',
              description: 'Allow graduate-level students to access the platform.',
            },
            maxUsage: {
              type: 'integer',
              minimum: 1,
              maximum: BYPASS_TOKEN_MAX_USAGE_MAX,
              description: 'Maximum number of distinct users who may activate this token.',
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
              description:
                'Expiry timestamp for the token itself. Must be at least 1 hour and at most the configured maximum days in the future.',
            },
          },
        },

        GlobalBypassToken: {
          allOf: [
            { $ref: '#/components/schemas/GlobalBypassTokenCreateBody' },
            { $ref: '#/components/schemas/BypassTokensCommonFields' },
            {
              type: 'object',
              required: ['bypassNotStudying', 'bypassGraduate', 'maxUsage', 'validUntil'],
              properties: {
                validUntil: { type: 'string', format: 'date-time' },
              },
            },
          ],
        },

        ElectionBypassTokenCreateBody: {
          type: 'object',
          required: ['bypassRestrictions', 'maxUsage'],
          properties: {
            bypassRestrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionRestrictionType' },
              minItems: 1,
              description:
                "Restriction types this token bypasses. Every value must be present on the target election's own restrictions.",
            },
            maxUsage: {
              type: 'integer',
              minimum: 1,
              maximum: BYPASS_TOKEN_MAX_USAGE_MAX,
              description: 'Maximum number of distinct users who may activate this token.',
            },
          },
        },

        ElectionBypassToken: {
          allOf: [
            { $ref: '#/components/schemas/ElectionBypassTokenCreateBody' },
            { $ref: '#/components/schemas/BypassTokensCommonFields' },
            {
              type: 'object',
              required: ['electionId'],
              properties: {
                electionId: { type: 'string', format: 'uuid' },
              },
            },
          ],
        },

        // ──────────────────────────────────────────────────────────────────
        // FAQ
        // ──────────────────────────────────────────────────────────────────
        FaqItem: {
          type: 'object',
          required: ['id', 'categoryId', 'title', 'content', 'position'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            categoryId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            content: {
              type: 'string',
              description: 'Serialised Quill Delta JSON string.',
            },
            position: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        FaqCategoryCreateBody: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: FAQ_CATEGORY_TITLE_MAX_LENGTH },
          },
        },

        FaqItemCreateBody: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: FAQ_ITEM_TITLE_MAX_LENGTH },
            content: {
              type: 'string',
              minLength: 1,
              description: `Serialised Quill Delta JSON string. Plain-text length must not exceed ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters.`,
            },
          },
        },

        /** Lightweight category shape returned by POST /api/faq and PUT /api/faq/categories/[id] */
        FaqCategoryMeta: {
          type: 'object',
          required: ['id', 'title', 'position'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        /** Full category shape returned by GET /api/faq */
        FaqCategory: {
          allOf: [
            { $ref: '#/components/schemas/FaqCategoryMeta' },
            {
              type: 'object',
              required: ['items'],
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/FaqItem' },
                },
              },
            },
          ],
        },

        // ──────────────────────────────────────────────────────────────────
        // Groups
        // ──────────────────────────────────────────────────────────────────
        GroupRequisites: {
          type: 'object',
          description: 'Official contact details used for protocol document generation.',
          properties: {
            fullName: {
              type: 'string',
              nullable: true,
              description: 'Full legal name of the organisation.',
            },
            address: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            contact: {
              type: 'string',
              nullable: true,
              description: 'Phone or other contact detail.',
            },
            logo: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/FileSummary' }],
              description: 'Current group logo. Null when no logo is set or the file was deleted.',
            },
          },
        },

        GroupMember: {
          type: 'object',
          required: ['userId', 'displayName', 'joinedAt', 'isOwner', 'avatarUrl'],
          properties: {
            userId: { type: 'string' },
            displayName: { type: 'string' },
            role: {
              type: 'string',
              nullable: true,
              description: 'Free-form role label used in protocol generation (e.g. "Голова").',
            },
            joinedAt: { type: 'string', format: 'date-time' },
            isOwner: { type: 'boolean' },
            avatarUrl: { type: 'string', nullable: true },
          },
        },

        GroupInviteLinkUsage: {
          type: 'object',
          required: ['id', 'userId', 'usedAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            usedAt: { type: 'string', format: 'date-time' },
          },
        },

        GroupInviteLink: {
          type: 'object',
          required: [
            'id',
            'groupId',
            'maxUsage',
            'currentUsage',
            'expiresAt',
            'createdBy',
            'createdAt',
            'usages',
            'canRevoke',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            groupId: { type: 'string', format: 'uuid' },
            label: { type: 'string', nullable: true },
            maxUsage: { type: 'integer', minimum: 1 },
            currentUsage: { type: 'integer', minimum: 0 },
            expiresAt: { type: 'string', format: 'date-time' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            deletedBy: { type: 'string', nullable: true },
            usages: {
              type: 'array',
              items: { $ref: '#/components/schemas/GroupInviteLinkUsage' },
            },
            canRevoke: {
              type: 'boolean',
              description:
                'True when the link is not deleted, not expired, and usage limit not reached.',
            },
          },
        },

        GroupSummary: {
          type: 'object',
          description: 'Lightweight group representation returned in list endpoints.',
          required: [
            'id',
            'name',
            'type',
            'ownerId',
            'createdBy',
            'createdAt',
            'updatedAt',
            'memberCount',
            'isOwner',
            'isMember',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['VKSU', 'OTHER'] },
            ownerId: { type: 'string' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            memberCount: { type: 'integer', minimum: 0 },
            isOwner: { type: 'boolean' },
            isMember: { type: 'boolean' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },

        GroupDetail: {
          allOf: [
            { $ref: '#/components/schemas/GroupSummary' },
            {
              type: 'object',
              required: ['requisites', 'members', 'inviteLinks', 'elections'],
              properties: {
                requisites: { $ref: '#/components/schemas/GroupRequisites' },
                members: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GroupMember' },
                  description: 'All non-deleted members ordered by join date.',
                },
                inviteLinks: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/GroupInviteLink' },
                  description:
                    'All invite links (active and revoked). Only populated for the group owner and admins with manage_groups; empty array otherwise.',
                },
                elections: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Election' },
                  description:
                    "Elections that restrict eligibility to this group's membership. Non-members only see publicly-viewable elections.",
                },
              },
            },
          ],
        },

        AdminGroupSummary: {
          type: 'object',
          description: 'Compact group summary returned by GET /api/groups/all (admin only).',
          required: [
            'id',
            'name',
            'type',
            'ownerId',
            'memberCount',
            'requisites',
            'createdAt',
            'isOwner',
            'isMember',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['VKSU', 'OTHER'] },
            ownerId: { type: 'string' },
            ownerName: { type: 'string', nullable: true },
            memberCount: { type: 'integer', minimum: 0 },
            requisites: { $ref: '#/components/schemas/GroupRequisites' },
            createdAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            isOwner: { type: 'boolean' },
            isMember: { type: 'boolean' },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Election campaigns
        // ──────────────────────────────────────────────────────────────────
        ElectionCampaignRestriction: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { $ref: '#/components/schemas/ElectionRestrictionType' },
            value: { type: 'string' },
          },
        },

        ElectionCampaign: {
          type: 'object',
          description: 'An orchestrated multi-stage election process for a ВКСУ group.',
          required: [
            'id',
            'groupId',
            'groupName',
            'positionTitle',
            'electionKind',
            'state',
            'announcedAt',
            'registrationClosesAt',
            'signatureCollection',
            'teamSize',
            'requiresCampaignProgram',
            'votingOpensAt',
            'votingClosesAt',
            'restrictions',
            'createdBy',
            'createdByFullName',
            'createdAt',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            groupId: { type: 'string', format: 'uuid' },
            groupName: { type: 'string' },
            positionTitle: {
              type: 'string',
              description: 'Title of the position being elected (e.g. "Голова профбюро").',
            },
            electionKind: {
              type: 'string',
              enum: ['REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT'],
              description:
                'Class of election per ВКСУ rules. Captured for record-keeping; does not affect the state machine.',
            },
            state: {
              type: 'string',
              enum: [
                'ANNOUNCED',
                'REGISTRATION_OPEN',
                'REGISTRATION_REVIEW',
                'SIGNATURES_OPEN',
                'SIGNATURES_REVIEW',
                'VOTING_OPEN',
                'VOTING_CLOSED',
                'COMPLETED',
                'FAILED',
                'CANCELLED',
              ],
              description:
                'Current phase of the campaign. Transitions are driven automatically by a cron job based on the configured timestamps.',
            },
            announcedAt: {
              type: 'string',
              format: 'date-time',
              description:
                'The moment registration opens. The ANNOUNCED phase begins at creation and ends here.',
            },
            registrationClosesAt: { type: 'string', format: 'date-time' },
            signaturesOpensAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'Start of the signature-collection phase. Null when signatureCollection is false.',
            },
            signaturesClosesAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'End of the signature-collection phase. Null when signatureCollection is false.',
            },
            signatureCollection: {
              type: 'boolean',
              description:
                'When true, each approved candidate must collect signatures before advancing to the final vote.',
            },
            signatureQuorum: {
              type: 'integer',
              nullable: true,
              description:
                'Number of signatures each candidate must collect. Null when signatureCollection is false.',
            },
            teamSize: {
              type: 'integer',
              minimum: 0,
              description: 'Number of required team members per candidate. 0 means solo candidacy.',
            },
            requiresCampaignProgram: {
              type: 'boolean',
              description: 'Whether candidates must submit a campaign-programme URL.',
            },
            votingOpensAt: { type: 'string', format: 'date-time' },
            votingClosesAt: { type: 'string', format: 'date-time' },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionCampaignRestriction' },
              description:
                'Voter-eligibility restrictions copied verbatim to the auto-created registration form and all child elections.',
            },
            registrationFormId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description:
                'Auto-created CandidateRegistrationForm once the campaign advances past ANNOUNCED.',
            },
            finalElectionId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description:
                'Auto-created final Election once the campaign reaches the voting phase.',
            },
            createdBy: { type: 'string' },
            createdByFullName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },

        CreateElectionCampaignBody: {
          type: 'object',
          required: [
            'positionTitle',
            'electionKind',
            'announcedAt',
            'registrationClosesAt',
            'signatureCollection',
            'votingOpensAt',
            'votingClosesAt',
          ],
          properties: {
            positionTitle: { type: 'string', minLength: 1 },
            electionKind: {
              type: 'string',
              enum: ['REGULAR', 'BY_ELECTION', 'REPLACEMENT', 'REPEAT'],
            },
            announcedAt: { type: 'string', format: 'date-time' },
            registrationClosesAt: { type: 'string', format: 'date-time' },
            signatureCollection: { type: 'boolean' },
            signaturesOpensAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Required when signatureCollection is true.',
            },
            signaturesClosesAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Required when signatureCollection is true.',
            },
            signatureQuorum: {
              type: 'integer',
              nullable: true,
              minimum: 1,
              description: 'Required when signatureCollection is true.',
            },
            teamSize: { type: 'integer', minimum: 0, description: 'Defaults to 0 (solo).' },
            requiresCampaignProgram: { type: 'boolean', description: 'Defaults to false.' },
            votingOpensAt: { type: 'string', format: 'date-time' },
            votingClosesAt: { type: 'string', format: 'date-time' },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionCampaignRestriction' },
              description: 'Defaults to empty array (no restrictions).',
            },
          },
        },

        CampaignSignatureElectionSummary: {
          type: 'object',
          required: [
            'electionId',
            'registrationId',
            'candidateUserId',
            'candidateFullName',
            'opensAt',
            'closesAt',
            'ballotCount',
            'quorum',
            'quorumReached',
            'status',
          ],
          properties: {
            electionId: { type: 'string', format: 'uuid' },
            registrationId: { type: 'string', format: 'uuid' },
            candidateUserId: { type: 'string' },
            candidateFullName: { type: 'string' },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            ballotCount: { type: 'integer', minimum: 0 },
            quorum: {
              type: 'integer',
              minimum: 0,
              description:
                "Number of signatures required. Sourced from the campaign's signatureQuorum.",
            },
            quorumReached: {
              type: 'boolean',
              description: 'True when quorum > 0 and ballotCount >= quorum.',
            },
            status: { type: 'string', enum: ['upcoming', 'open', 'closed'] },
          },
        },

        CampaignFinalElectionChoice: {
          type: 'object',
          required: ['candidateFullName', 'position'],
          properties: {
            candidateRegistrationId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'Links back to the CandidateRegistration for this choice.',
            },
            candidateFullName: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
            voteCount: {
              type: 'integer',
              minimum: 0,
              nullable: true,
              description: 'Null while the election is not yet closed and tallied.',
            },
          },
        },

        CampaignFinalElectionSummary: {
          type: 'object',
          nullable: true,
          description: 'Null when the campaign has not yet spawned a final election.',
          required: ['electionId', 'status', 'opensAt', 'closesAt', 'ballotCount', 'choices'],
          properties: {
            electionId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['upcoming', 'open', 'closed'] },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            ballotCount: { type: 'integer', minimum: 0 },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/CampaignFinalElectionChoice' },
            },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Candidate registration forms & registrations
        // ──────────────────────────────────────────────────────────────────
        CandidateRegistrationFormRestriction: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { $ref: '#/components/schemas/ElectionRestrictionType' },
            value: { type: 'string' },
          },
        },

        CandidateRegistrationForm: {
          type: 'object',
          required: [
            'id',
            'groupId',
            'groupName',
            'title',
            'requiresCampaignProgram',
            'teamSize',
            'opensAt',
            'closesAt',
            'restrictions',
            'createdBy',
            'createdByFullName',
            'createdAt',
            'updatedAt',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            groupId: { type: 'string', format: 'uuid' },
            groupName: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            requiresCampaignProgram: {
              type: 'boolean',
              description: 'Whether candidates must submit a campaign-programme URL when applying.',
            },
            teamSize: {
              type: 'integer',
              minimum: 0,
              description:
                '0 means solo candidacy; > 0 requires the candidate to invite that many team members.',
            },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/CandidateRegistrationFormRestriction' },
            },
            createdBy: { type: 'string' },
            createdByFullName: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        CreateCandidateRegistrationFormBody: {
          type: 'object',
          required: ['title', 'opensAt', 'closesAt'],
          properties: {
            title: { type: 'string', minLength: 1 },
            description: { type: 'string', nullable: true },
            requiresCampaignProgram: { type: 'boolean', description: 'Defaults to false.' },
            teamSize: { type: 'integer', minimum: 0, description: 'Defaults to 0.' },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/CandidateRegistrationFormRestriction' },
            },
          },
        },

        CandidateRegistration: {
          type: 'object',
          required: [
            'id',
            'formId',
            'userId',
            'fullName',
            'phoneNumber',
            'telegramTag',
            'status',
            'createdAt',
            'updatedAt',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            formId: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            fullName: { type: 'string' },
            group: { type: 'string', nullable: true },
            faculty: { type: 'string', nullable: true },
            phoneNumber: { type: 'string' },
            telegramTag: { type: 'string' },
            campaignProgramUrl: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: [
                'DRAFT',
                'AWAITING_TEAM',
                'PENDING_REVIEW',
                'APPROVED',
                'REJECTED',
                'WITHDRAWN',
              ],
            },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewedByUserId: { type: 'string', nullable: true },
            reviewedByFullName: { type: 'string', nullable: true },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            rejectionReason: { type: 'string', nullable: true },
            withdrawnAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Team invites
        // ──────────────────────────────────────────────────────────────────
        TeamSlot: {
          type: 'object',
          description: 'Per-slot status view for the candidate.',
          required: ['slot', 'state'],
          properties: {
            slot: { type: 'integer', minimum: 1 },
            state: {
              type: 'string',
              enum: [
                'empty',
                'pending',
                'rejected',
                'expired',
                'awaiting_candidate',
                'declined',
                'accepted',
              ],
              description:
                'empty = no token issued. pending = outstanding invite awaiting response. rejected = invitee declined. expired = token expired or revoked before use. awaiting_candidate = invitee accepted, candidate must confirm or decline. declined = candidate declined the accepted invitee. accepted = invitee accepted and candidate confirmed (terminal).',
            },
            member: {
              nullable: true,
              type: 'object',
              description: 'Always set for accepted; informative for rejected.',
              properties: {
                userId: { type: 'string' },
                fullName: { type: 'string' },
                group: { type: 'string', nullable: true },
                faculty: { type: 'string', nullable: true },
              },
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Active token expiry. Only set when state is pending.',
            },
            resolvedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the slot was last filled or a decision was taken.',
            },
          },
        },

        TeamInvitePreview: {
          type: 'object',
          description:
            'Metadata about a team invite shown to a prospective member before they accept.',
          required: [
            'token',
            'registrationId',
            'slot',
            'candidate',
            'formId',
            'formTitle',
            'groupName',
            'expiresAt',
            'used',
            'response',
            'candidateDecision',
            'revoked',
            'formClosed',
          ],
          properties: {
            token: { type: 'string' },
            registrationId: { type: 'string', format: 'uuid' },
            slot: { type: 'integer', minimum: 1 },
            candidate: {
              type: 'object',
              required: ['userId', 'fullName'],
              properties: {
                userId: { type: 'string' },
                fullName: { type: 'string' },
              },
            },
            formId: { type: 'string', format: 'uuid' },
            formTitle: { type: 'string' },
            groupName: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            used: { type: 'boolean', description: 'True when the invitee has already responded.' },
            response: {
              type: 'string',
              enum: ['ACCEPTED', 'REJECTED'],
              nullable: true,
              description: "The invitee's response. Null until they respond.",
            },
            candidateDecision: {
              type: 'string',
              enum: ['CONFIRMED', 'DECLINED'],
              nullable: true,
              description:
                "The candidate's decision on an accepted invitee. Only meaningful once response is ACCEPTED.",
            },
            revoked: {
              type: 'boolean',
              description: 'True when the token was revoked before use.',
            },
            formClosed: {
              type: 'boolean',
              description:
                'True when the form has been soft-deleted or its submission window has closed.',
            },
          },
        },

        // ──────────────────────────────────────────────────────────────────
        // Protocols
        // ──────────────────────────────────────────────────────────────────
        ProtocolResponsible: {
          type: 'object',
          required: ['posada', 'fullname'],
          properties: {
            posada: { type: 'string', description: 'Position / role title.' },
            fullname: { type: 'string' },
          },
        },

        ProtocolAttendee: {
          type: 'object',
          required: ['fullname', 'posada', 'present_text'],
          properties: {
            userId: {
              type: 'string',
              nullable: true,
              description: 'Optional reference to a GroupMember row this entry was sourced from.',
            },
            fullname: { type: 'string' },
            posada: { type: 'string' },
            present_text: {
              type: 'string',
              description: 'Human-readable attendance note (e.g. "присутній" / "відсутній").',
            },
          },
        },

        ProtocolListener: {
          type: 'object',
          required: ['fullname', 'speech'],
          properties: {
            fullname: { type: 'string' },
            speech: { type: 'string', description: "Summary of the speaker's contribution." },
          },
        },

        ProtocolAgendaItem: {
          type: 'object',
          required: ['id', 'position', 'name', 'listeners'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            position: { type: 'integer', minimum: 0 },
            name: { type: 'string' },
            listeners: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolListener' },
            },
            result: { type: 'string', nullable: true },
            electionId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description:
                'Linked closed election. Only GROUP_MEMBERSHIP-restricted elections with exactly the required number of choices may be linked.',
            },
            choiceMapping: {
              type: 'object',
              nullable: true,
              additionalProperties: {
                type: 'string',
                enum: ['yes', 'no', 'abstain'],
              },
              description:
                'Maps each election choice UUID to yes/no/abstain. Must cover every choice when electionId is set.',
            },
          },
        },

        ProtocolAgendaItemInput: {
          type: 'object',
          required: ['name', 'listeners'],
          description:
            'Input shape for a protocol agenda item. Position is derived from array order.',
          properties: {
            name: { type: 'string', minLength: 1 },
            listeners: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolListener' },
            },
            result: { type: 'string', nullable: true },
            electionId: { type: 'string', format: 'uuid', nullable: true },
            choiceMapping: {
              type: 'object',
              nullable: true,
              additionalProperties: { type: 'string', enum: ['yes', 'no', 'abstain'] },
            },
          },
        },

        ProtocolOssSnapshot: {
          type: 'object',
          description: "Snapshot of the group's requisites captured at protocol creation time.",
          required: ['name', 'address', 'email', 'contact'],
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            email: { type: 'string' },
            contact: { type: 'string' },
          },
        },

        Protocol: {
          type: 'object',
          required: [
            'id',
            'groupId',
            'number',
            'name',
            'date',
            'responsibles',
            'attendance',
            'ossSnapshot',
            'createdBy',
            'createdAt',
            'updatedAt',
            'agendaItems',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            groupId: { type: 'string', format: 'uuid' },
            number: { type: 'integer', minimum: 1 },
            name: { type: 'string' },
            date: {
              type: 'string',
              format: 'date',
              description: 'Date of the meeting (YYYY-MM-DD).',
            },
            visitors: { type: 'integer', minimum: 0, nullable: true },
            responsibles: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolResponsible' },
            },
            attendance: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolAttendee' },
            },
            ossSnapshot: { $ref: '#/components/schemas/ProtocolOssSnapshot' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            agendaItems: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolAgendaItem' },
            },
          },
        },

        ProtocolSummary: {
          type: 'object',
          required: [
            'id',
            'groupId',
            'number',
            'name',
            'date',
            'agendaItemCount',
            'createdAt',
            'updatedAt',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            groupId: { type: 'string', format: 'uuid' },
            number: { type: 'integer' },
            name: { type: 'string' },
            date: { type: 'string', format: 'date' },
            agendaItemCount: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        ProtocolComputedCounts: {
          type: 'object',
          description: "Quorum-related counts derived from the protocol's attendance list.",
          required: ['total', 'present', 'quorum'],
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of members on record for the group.',
            },
            present: { type: 'integer', description: 'Number of attendees marked as present.' },
            quorum: {
              type: 'integer',
              description: 'Minimum members required for a valid session.',
            },
          },
        },

        CreateProtocolBody: {
          type: 'object',
          required: ['number', 'name', 'date', 'responsibles', 'attendance', 'agendaItems'],
          properties: {
            number: {
              type: 'integer',
              minimum: 1,
              description: 'Sequential protocol number for the year.',
            },
            name: { type: 'string', minLength: 1 },
            date: {
              type: 'string',
              format: 'date',
              description: 'Date of the meeting (YYYY-MM-DD).',
            },
            visitors: { type: 'integer', minimum: 0, nullable: true },
            responsibles: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolResponsible' },
            },
            attendance: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolAttendee' },
            },
            agendaItems: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProtocolAgendaItemInput' },
            },
            ossSnapshotOverride: {
              type: 'object',
              nullable: true,
              description:
                "Optional override of the group's current requisites at creation time. Only the provided fields are overridden; omitted fields fall back to the group's live values.",
              properties: {
                name: { type: 'string' },
                address: { type: 'string' },
                email: { type: 'string' },
                contact: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
});

const outputPath = path.join(process.cwd(), 'public', 'openapi.json');

fs.writeFileSync(outputPath, JSON.stringify(spec));

console.log('✅ OpenAPI spec generated at public/openapi.json');
