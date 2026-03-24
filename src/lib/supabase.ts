// ============================================================
// Nexus Data — Supabase Client
// Shared Supabase project with azimute-blog (same credentials).
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --------------- environment helpers ---------------

// Explicit mapping from env var name to window global key
const WINDOW_GLOBALS: Record<string, string> = {
  PUBLIC_SUPABASE_URL: '__NEXUS_SUPABASE_URL__',
  PUBLIC_SUPABASE_ANON_KEY: '__NEXUS_SUPABASE_ANON_KEY__',
};

function requireEnv(name: string): string {
  // Browser: check window globals injected by NexusApp (via supabaseUrl/supabaseAnonKey props)
  if (typeof window !== 'undefined') {
    const windowKey = WINDOW_GLOBALS[name];
    if (windowKey) {
      const value = (window as Record<string, string>)[windowKey];
      if (value) return value;
    }
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
 * Browser: uses @supabase/ssr createBrowserClient to read auth cookies.
 * Node/SSR: plain createClient.
 */
export function getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const url = requireEnv("PUBLIC_SUPABASE_URL");
    const key = requireEnv("PUBLIC_SUPABASE_ANON_KEY");
    if (typeof window !== 'undefined') {
      // Browser: createBrowserClient reads session from cookies automatically
      const { createBrowserClient } = require('@supabase/ssr');
      _anonClient = createBrowserClient(url, key);
    } else {
      _anonClient = createClient(url, key);
    }
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
