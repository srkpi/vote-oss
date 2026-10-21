import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { jsonResponse } from '../helpers';

export const campusRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: '/api/campus/groups',
    summary: 'Get faculty to groups mapping',
    description:
      'Returns the full faculty-to-groups mapping sourced from the campus API. Used to populate faculty/group pickers in the election creation form. Requires any authenticated user.\n',
    tags: ['Campus'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': jsonResponse('Faculty to groups mapping', {
        type: 'object',
        additionalProperties: { type: 'array', items: { type: 'string' } },
        example: { ФІОТ: ['ІП-24', 'ІП-25'] },
      }),
      '401': { description: 'Unauthorized' },
      '500': { description: 'Failed to fetch data from the campus API' },
    },
  },
];
