import fs from 'fs';
import { createSwaggerSpec } from 'next-swagger-doc';
import path from 'path';

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
            maxUsage: { type: 'integer', minimum: 1, maximum: 100 },
            currentUsage: { type: 'integer', minimum: 0 },
            manageAdmins: {
              type: 'boolean',
              description: 'Whether redeeming this token grants manage_admins.',
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

        ElectionChoice: {
          type: 'object',
          required: ['id', 'choice', 'position'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            choice: { type: 'string' },
            position: { type: 'integer', minimum: 0 },
          },
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

        /** Returned by GET /api/elections (list view) */
        Election: {
          type: 'object',
          required: [
            'id',
            'title',
            'createdAt',
            'opensAt',
            'closesAt',
            'status',
            'publicKey',
            'creator',
            'choices',
            'ballotCount',
          ],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            opensAt: { type: 'string', format: 'date-time' },
            closesAt: { type: 'string', format: 'date-time' },
            status: { $ref: '#/components/schemas/ElectionStatus' },
            restrictedToFaculty: { type: 'string', nullable: true },
            restrictedToGroup: { type: 'string', nullable: true },
            publicKey: { type: 'string', description: 'PEM-encoded RSA public key.' },
            privateKey: {
              type: 'string',
              nullable: true,
              description: 'PEM-encoded RSA private key. Only present once the election is closed.',
            },
            creator: { $ref: '#/components/schemas/ElectionCreator' },
            choices: {
              type: 'array',
              items: { $ref: '#/components/schemas/ElectionChoice' },
            },
            ballotCount: { type: 'integer', minimum: 0 },
          },
        },

        /** Returned by GET /api/elections/[id] (detail view – adds hasVoted) */
        ElectionDetail: {
          allOf: [
            { $ref: '#/components/schemas/Election' },
            {
              type: 'object',
              properties: {
                hasVoted: {
                  type: 'boolean',
                  nullable: true,
                  description:
                    'Present only while the election is open. True if the caller has already been issued a vote token.',
                },
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
