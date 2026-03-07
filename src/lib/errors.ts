import { NextResponse } from 'next/server';

export type ApiError = {
  error: string;
  message: string;
  statusCode: number;
};

export function apiError(
  message: string,
  statusCode: number,
  error = 'Error',
): NextResponse<ApiError> {
  return NextResponse.json({ error, message, statusCode }, { status: statusCode });
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => apiError(msg, 401, 'Unauthorized'),
  forbidden: (msg = 'Forbidden') => apiError(msg, 403, 'Forbidden'),
  notFound: (msg = 'Not found') => apiError(msg, 404, 'NotFound'),
  badRequest: (msg = 'Bad request') => apiError(msg, 400, 'BadRequest'),
  conflict: (msg = 'Conflict') => apiError(msg, 409, 'Conflict'),
  internal: (msg = 'Internal server error') => apiError(msg, 500, 'InternalServerError'),
};
