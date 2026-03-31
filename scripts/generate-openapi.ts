import fs from 'fs';
import { createSwaggerSpec } from 'next-swagger-doc';
import path from 'path';

import {
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
        UserRef: {
          type: 'object',
          description: 'Minimal user reference embedded in other resources.',
          required: ['userId', 'fullName'],
          properties: {
            userId: { type: 'string' },
            fullName: { type: 'string' },
          },
        },

        Admin: {
          type: 'object',
          description: 'An active (non-deleted) admin record.',
          required: [
            'userId',
            'fullName',
            'group',
            'faculty',
            'promotedAt',
            'manageAdmins',
            'restrictedToFaculty',
          ],
          properties: {
            userId: {
              type: 'string',
              description: 'Unique identifier matching the KPI-ID subject claim.',
            },
            fullName: { type: 'string' },
            group: { type: 'string' },
            faculty: { type: 'string' },
            promoter: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/UserRef' }],
              description: 'Admin who promoted this user; null for the root admin.',
            },
            promotedAt: {
              type: 'string',
              format: 'date-time',
            },
            manageAdmins: {
              type: 'boolean',
              description: 'Whether this admin can invite / remove other admins.',
            },
            restrictedToFaculty: {
              type: 'boolean',
              description:
                'When true the admin can only see and manage resources scoped to their faculty.',
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
              description: 'Maximum number of times the token can be used',
            },
            manageAdmins: {
              type: 'boolean',
              description: 'Whether redeeming this token grants manage admins permission.',
            },
            restrictedToFaculty: {
              type: 'boolean',
              description: "Whether the invited admin is restricted to the creator's faculty.",
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
              description: 'Maximum number of times the token can be used',
            },
            currentUsage: { type: 'integer', minimum: 0 },
            manageAdmins: {
              type: 'boolean',
              description: 'Whether redeeming this token grants manage admins permission.',
            },
            restrictedToFaculty: {
              type: 'boolean',
              description: 'Whether the invited admin will be faculty-restricted.',
            },
            validDue: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            creator: { $ref: '#/components/schemas/UserRef' },
            isOwn: {
              type: 'boolean',
              description: 'True when the token was created by the calling admin.',
            },
            deletable: {
              type: 'boolean',
              description: 'Always true for tokens returned in this list.',
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
                votes: { type: 'integer', minimum: 0 },
                winner: { type: 'boolean' },
              },
            },
          ],
        },

        ElectionCreator: {
          type: 'object',
          required: ['fullName', 'faculty'],
          properties: {
            fullName: { type: 'string' },
            faculty: { type: 'string' },
          },
        },

        ElectionStatus: {
          type: 'string',
          enum: ['upcoming', 'open', 'closed'],
        },

        ElectionRestrictionType: {
          type: 'string',
          enum: ['FACULTY', 'GROUP', 'SPECIALITY', 'STUDY_YEAR', 'STUDY_FORM', 'LEVEL_COURSE'],
        },

        ElectionRestriction: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: { $ref: '#/components/schemas/ElectionRestrictionType' },
            value: { type: 'string' },
          },
        },

        ElectionForBallotsResponse: {
          type: 'object',
          required: ['id', 'title', 'status', 'ballotCount', 'choices'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', minLength: 1, maxLength: ELECTION_TITLE_MAX_LENGTH },
            status: { $ref: '#/components/schemas/ElectionStatus' },
            ballotCount: { type: 'integer', minimum: 0 },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionChoiceResponse' },
              minItems: ELECTION_CHOICES_MIN,
              maxItems: ELECTION_CHOICES_MAX,
            },
            privateKey: {
              type: 'string',
              description: 'PEM-encoded RSA private key. Only present once the election is closed.',
            },
          },
        },

        ElectionCreateBody: {
          type: 'object',
          required: ['title', 'opensAt', 'closesAt', 'choices'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: ELECTION_TITLE_MAX_LENGTH },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionChoiceCreateBody' },
              minItems: ELECTION_CHOICES_MIN,
              maxItems: ELECTION_CHOICES_MAX,
            },
            minChoices: {
              type: 'integer',
              minimun: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
            },
            maxChoices: {
              type: 'integer',
              minimun: ELECTION_MIN_CHOICES_MIN,
              maximum: ELECTION_MAX_CHOICES_MAX,
            },
            restrictions: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionRestriction' },
            },
          },
        },

        Election: {
          allOf: [
            { $ref: '#/components/schemas/ElectionCreateBody' },
            {
              type: 'object',
              required: [
                'id',
                'createdAt',
                'minChoices',
                'maxChoices',
                'restrictions',
                'status',
                'creator',
                'ballotCount',
                'choices',
              ],
              properties: {
                id: { type: 'string', format: 'uuid' },
                createdAt: { type: 'string', format: 'date-time' },
                status: { $ref: '#/components/schemas/ElectionStatus' },
                creator: { $ref: '#/components/schemas/ElectionCreator' },
                ballotCount: { type: 'integer', minimum: 0 },
                choices: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ElectionChoiceResponse' },
                  minItems: ELECTION_CHOICES_MIN,
                  maxItems: ELECTION_CHOICES_MAX,
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
              required: ['publicKey'],
              properties: {
                publicKey: { type: 'string', description: 'PEM-encoded RSA public key.' },
                privateKey: {
                  type: 'string',
                  description:
                    'PEM-encoded RSA private key. Only present once the election is closed.',
                },
                hasVoted: {
                  type: 'boolean',
                  description:
                    'Present only while the election is open. True if the caller has already been issued a vote token.',
                },
                deletedAt: { type: 'string', nullable: true, format: 'date-time' },
                deletedBy: { type: 'string', nullable: true },
                canDelete: { type: 'boolean' },
                canRestore: { type: 'boolean' },
              },
            },
          ],
        },

        Ballot: {
          type: 'object',
          required: ['id', 'encryptedBallot', 'createdAt', 'signature', 'currentHash'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            encryptedBallot: {
              type: 'string',
              description: 'Base64-encoded RSA-encrypted choice ID.',
            },
            createdAt: { type: 'string', format: 'date-time' },
            signature: {
              type: 'string',
              description: 'ECDSA signature over (electionId + encryptedBallot + previousHash).',
            },
            previousHash: {
              type: 'string',
              nullable: true,
              description: 'Hash of the preceding ballot entry; null for the first ballot.',
            },
            currentHash: {
              type: 'string',
              description: 'SHA-256 hash of this ballot entry – forms the chain.',
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

        FaqItem: {
          type: 'object',
          required: ['id', 'categoryId', 'title', 'content', 'position'],
          properties: {
            id: { type: 'string' },
            categoryId: { type: 'string' },
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
              description: `Serialised Quill Delta JSON; plain-text length must not exceed ${FAQ_ITEM_CONTENT_MAX_LENGTH} characters.`,
            },
          },
        },

        /** Lightweight category shape returned by POST /api/faq and PUT /api/faq/categories/[id] */
        FaqCategoryMeta: {
          type: 'object',
          required: ['id', 'title', 'position'],
          properties: {
            id: { type: 'string' },
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
      },
    },
  },
});

const outputPath = path.join(process.cwd(), 'public', 'openapi.json');

fs.writeFileSync(outputPath, JSON.stringify(spec));

console.log('✅ OpenAPI spec generated at public/openapi.json');
