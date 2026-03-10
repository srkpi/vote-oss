export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number };
