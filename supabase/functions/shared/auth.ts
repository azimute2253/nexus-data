// ============================================================
// Nexus Data — Auth Middleware
// Extracts and validates Supabase JWT from the Authorization header.
// ============================================================

import { createClient, type User } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "./response.ts";

export interface AuthResult {
  user: User;
}

/**
 * Validates the Authorization header and returns the authenticated user.
 *
 * Returns a `Response` (401) if authentication fails, or `AuthResult` on success.
 * Usage:
 * ```ts
 * const auth = await requireAuth(req);
 * if (auth instanceof Response) return auth;
 * const { user } = auth;
 * ```
 */
export async function requireAuth(
  req: Request,
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("unauthorized", "Missing Authorization header", 401);
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";
  if (!token) {
    return errorResponse("unauthorized", "Missing bearer token", 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(
      "server_error",
      "Server misconfigured: missing Supabase credentials",
      500,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return errorResponse(
      "unauthorized",
      error?.message ?? "Invalid or expired token",
      401,
    );
  }

  return { user: data.user };
}
