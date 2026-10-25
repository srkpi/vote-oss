import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

export const authRoutes: RouteConfig[] = [
  {
    method: 'post',
    path: '/api/auth/refresh',
    summary: 'Refresh the access token',
    description:
      "Issues a new access + refresh token pair using the caller's valid refresh token cookie (token rotation). The old refresh token is revoked immediately. Admin status is re-evaluated against the database on every refresh. Rate-limited per IP.\n",
    tags: ['Auth'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': {
        description: 'New token pair issued; cookies updated',
        headers: {
          'Set-Cookie': {
            description: 'Rotated HTTP-only access and refresh token cookies',
            schema: { type: 'string' },
          },
        },
      },
      '401': { description: 'Refresh token invalid/revoked, or global bypass was revoked' },
      '429': {
        description: 'Too many refresh requests',
        headers: { 'Retry-After': { schema: { type: 'integer' } } },
      },
    },
  },
  {
    method: 'post',
    path: '/api/auth/logout',
    summary: 'Log out the current user',
    description:
      "Revokes the caller's access token in the token store and clears both the access and refresh JWT cookies. Requires a valid access token.\n",
    tags: ['Auth'],
    security: [{ cookieAuth: [] }],
    responses: {
      '200': { description: 'Logged out successfully; cookies cleared' },
      '401': { description: 'Unauthorized – no valid access token present' },
    },
  },
  {
    method: 'post',
    path: '/api/auth/kpi-id',
    summary: 'Authenticate via KPI-ID ticket',
    description:
      'Exchanges a KPI-ID CAS ticket for a pair of HTTP-only JWT cookies (access + refresh). The ticket must have been issued through Diia authentication (AUTH_METHOD === "DIIA"). Non-student accounts, graduate students, and tickets issued via other auth methods are rejected. Rate-limited per IP.\nIf a `pending_bypass` cookie is present (set by the proxy when an unauthenticated user was redirected from /use/[token]), the endpoint attempts to pre-apply that bypass token before checking campus eligibility. This resolves the chicken-and-egg situation where a student needs the bypass to log in but could previously only apply tokens after login.\nReturns a JSON body with `redirectTo` so the client does not need a separate call to /api/auth/return-to.\n',
    tags: ['Auth'],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ticketId'],
              properties: {
                ticketId: {
                  type: 'string',
                  description: 'CAS service ticket obtained from the KPI-ID provider',
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Authentication successful; JWT cookies set',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                redirectTo: { type: 'string', description: 'Post-login redirect path' },
              },
            },
          },
        },
        headers: {
          'Set-Cookie': {
            description: 'HTTP-only access and refresh token cookies',
            schema: { type: 'string' },
          },
        },
      },
      '400': { description: 'Missing or invalid ticketId' },
      '401': { description: 'Ticket is invalid or expired' },
      '403': {
        description:
          'Account is not a student, not authenticated through Diia, or is a graduate student',
      },
      '429': {
        description: 'Too many login attempts',
        headers: { 'Retry-After': { schema: { type: 'integer' } } },
      },
      '500': { description: 'Failed to contact the KPI-ID auth provider' },
    },
  },
];
