import { type SupabaseClient } from "@supabase/supabase-js";
/**
 * Initialize Supabase credentials for browser usage.
 * Call before any getAnonClient() in browser context.
 */
export declare function initSupabase(url: string, anonKey: string): void;
/**
 * Returns a Supabase client authenticated with the **service role** key.
 * Use for server-side operations (Edge Functions, migrations, scripts).
 *
 * ⚠️  NEVER expose this client or key to the browser.
 */
export declare function getServiceClient(): SupabaseClient;
/**
 * Returns a Supabase client authenticated with the **anon** key.
 * Browser: uses @supabase/ssr createBrowserClient to read auth cookies.
 * Node/SSR: plain createClient with process.env.
 */
export declare function getAnonClient(): SupabaseClient;
/**
 * Checks the current session via the anon client.
 * Returns the session object or null if not authenticated.
 */
export declare function getSession(): Promise<import("@supabase/auth-js").Session | null>;
/**
 * Returns the current user from the session, or null.
 */
export declare function getCurrentUser(): Promise<import("@supabase/auth-js").User | null>;
//# sourceMappingURL=supabase.d.ts.map