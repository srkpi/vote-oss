export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export type ApiResult<T> =
  | { success: true; data: T; error: null; status: number }
  | { success: false; data: null; error: string; status: number };
