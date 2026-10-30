import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse } from '../helpers';

export const systemRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/info',
    summary: 'Application info',
    description: 'Returns general information about the application.',
    tags: ['System'],
    responses: {
      '200': jsonResponse('Application info retrieved successfully', {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The application name', example: 'MyApp' },
          url: {
            type: 'string',
            description: 'Base URL of the application',
            example: 'https://example.com',
          },
          docs: {
            type: 'string',
            description: 'URL to the API documentation',
            example: 'https://example.com/docs',
          },
          environment: {
            type: 'string',
            description: 'Current runtime environment',
            example: 'development',
          },
          build: {
            type: 'object',
            nullable: true,
            description:
              "Build provenance metadata for the running image, or null for local builds not produced by CI. `verify` contains ready-to-run commands that let anyone independently confirm this image was built by this project's official GitHub Actions workflow from the referenced commit, AND that the files this domain is actually serving right now match that same build — see scripts/verify-deployment.cjs and the BuildInfo component.\n",
            properties: {
              commit: { type: 'string', example: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' },
              repo: { type: 'string', example: 'srkpi/vote-oss' },
              commitUrl: {
                type: 'string',
                example:
                  'https://github.com/srkpi/vote-oss/commit/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
              },
              builtAt: { type: 'string', example: '2026-08-20T10:00:00Z' },
              actionsRunUrl: {
                type: 'string',
                example: 'https://github.com/srkpi/vote-oss/actions/runs/123456789',
              },
              docker: {
                type: 'object',
                properties: {
                  reference: { type: 'string', example: 'sckpi/vote-oss:sha-a1b2c3d' },
                  hubUrl: { type: 'string' },
                },
              },
              verify: {
                type: 'object',
                properties: {
                  inspect: {
                    type: 'string',
                    example: 'docker buildx imagetools inspect sckpi/vote-oss:sha-a1b2c3d',
                  },
                  attest: {
                    type: 'string',
                    example:
                      'gh attestation verify oci://docker.io/sckpi/vote-oss:sha-a1b2c3d --repo srkpi/vote-oss',
                  },
                  scriptUrl: {
                    type: 'string',
                    description: 'Raw URL of the verification script, pinned to this exact commit.',
                    example:
                      'https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs',
                  },
                  scriptCommand: {
                    type: 'string',
                    description:
                      'One-liner shell command for Unix-like environments to verify deployment.',
                    example:
                      'curl -fsSL https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs | node - https://voteoss.kpi.ua',
                  },
                  scriptCommandWindows: {
                    type: 'string',
                    description:
                      'One-liner command for Windows PowerShell environments to verify deployment.',
                    example:
                      '(Invoke-RestMethod -Uri https://raw.githubusercontent.com/srkpi/vote-oss/a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/scripts/verify-deployment.cjs | node - https://voteoss.kpi.ua',
                  },
                },
              },
            },
          },
        },
      }),
    },
  },
  {
    method: 'get',
    path: '/api/health',
    summary: 'Health check',
    description:
      'Verifies connectivity to the PostgreSQL database and Redis cache. Returns 200 when both are reachable, 503 otherwise. Suitable for use as a liveness/readiness probe.\n',
    tags: ['System'],
    responses: {
      '200': jsonResponse('All systems operational', {
        type: 'object',
        properties: { status: { type: 'string', example: 'ok' } },
      }),
      '503': jsonResponse('One or more dependencies are unavailable', {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'unavailable' },
          db: { type: 'boolean', example: false },
          redis: { type: 'boolean', example: false },
        },
      }),
    },
  },
];
