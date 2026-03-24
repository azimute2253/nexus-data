// ============================================================
// Nexus Data — Supabase Client
// Shared Supabase project with azimute-blog (same credentials).
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --------------- environment helpers ---------------

function requireEnv(name: string): string {
  // Browser: check window globals injected by NexusApp
  if (typeof window !== 'undefined') {
    const windowKey = `__NEXUS_${name}__`;
    const value = (window as Record<string, string>)[windowKey];
    if (value) return value;
  }
  // Node.js / SSR: process.env
  const value = (typeof process !== 'undefined' && process.env) ? process.env[name] : undefined;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// --------------- server client (service role) ---------------

let _serverClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client authenticated with the **service role** key.
 * Use for server-side operations (Edge Functions, migrations, scripts).
 *
 * ⚠️  NEVER expose this client or key to the browser.
 */
export function getServiceClient(): SupabaseClient {
  if (!_serverClient) {
    _serverClient = createClient(
      requireEnv("PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
  }
  return _serverClient;
}

// --------------- anon client (browser-safe) ---------------

let _anonClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client authenticated with the **anon** key.
 * Safe for browser use — respects RLS policies.
 */
export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(
      requireEnv("PUBLIC_SUPABASE_URL"),
      requireEnv("PUBLIC_SUPABASE_ANON_KEY"),
    );
  }
  return _anonClient;
}

// --------------- auth helpers ---------------

/**
 * Checks the current session via the anon client.
 * Returns the session object or null if not authenticated.
 */
export async function getSession() {
  const client = getAnonClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Returns the current user from the session, or null.
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}
