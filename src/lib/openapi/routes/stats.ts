import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse } from '../helpers';

export const statsRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/stats',
    summary: 'Public platform statistics',
    description:
      'Returns public aggregate statistics about the platform. This endpoint is unauthenticated and intended for public dashboards or landing pages.\n',
    tags: ['Stats'],
    responses: {
      '200': jsonResponse('Public statistics retrieved successfully', {
        type: 'object',
        properties: {
          elections: { type: 'integer', description: 'Total number of elections', example: 42 },
          ballots: {
            type: 'integer',
            description: 'Total number of ballots submitted for elections',
            example: 1280,
          },
          petitions: { type: 'integer', description: 'Total number of petitions', example: 12 },
        },
      }),
    },
  },
  {
    method: 'get',
    path: '/api/stats/admin',
    summary: 'Admin statistics',
    description:
      'Returns aggregated platform statistics for administrative dashboards. Includes counts for elections, open elections, ballots, petitions, groups, and admins. Requires admin authentication.\n',
    tags: ['Stats'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Admin statistics retrieved successfully', {
        type: 'object',
        properties: {
          elections: {
            type: 'integer',
            description: 'Total number of active elections',
            example: 42,
          },
          openElections: {
            type: 'integer',
            description: 'Number of currently open elections',
            example: 5,
          },
          ballots: {
            type: 'integer',
            description: 'Total number of ballots submitted for elections',
            example: 1280,
          },
          petitions: { type: 'integer', description: 'Total number of petitions', example: 12 },
          groups: { type: 'integer', description: 'Total number of active groups', example: 8 },
          admins: {
            type: 'integer',
            description: 'Total number of active administrators',
            example: 3,
          },
        },
      }),
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden – user is not an admin' },
    },
  },
];
