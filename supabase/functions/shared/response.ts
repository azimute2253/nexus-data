// ============================================================
// Nexus Data — Response Helpers
// Consistent JSON response format for all Edge Functions.
// ============================================================

import { CORS_HEADERS } from "./cors.ts";

/** Standard error response body. */
export interface ApiError {
  error: string;
  message: string;
  status: number;
}

/**
 * Returns a JSON success response with CORS headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Returns a consistent JSON error response with CORS headers.
 *
 * Format: `{ error: "<code>", message: "<human-readable>", status: <number> }`
 */
export function errorResponse(
  error: string,
  message: string,
  status: number,
): Response {
  const body: ApiError = { error, message, status };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
