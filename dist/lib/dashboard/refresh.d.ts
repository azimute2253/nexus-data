import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriceRefreshTrigger } from '../nexus/types.js';
import type { DataResult } from './types.js';
export interface RefreshResult {
    triggered: boolean;
    trigger: PriceRefreshTrigger;
    refreshed_at: string | null;
    skipped_reason: string | null;
}
export interface RefreshCooldownStatus {
    last_refreshed_at: string | null;
    hours_since_refresh: number | null;
    cooldown_hours: number;
    cooldown_expired: boolean;
}
/**
 * Fetches the most recent price_refresh_log entry.
 * Returns null if no entries exist (first-ever visit).
 */
export declare function getLastRefreshTimestamp(client: SupabaseClient): Promise<DataResult<string | null>>;
/**
 * Checks whether the auto-refresh cooldown has expired.
 * Returns cooldown status with computed hours since last refresh.
 */
export declare function checkCooldown(client: SupabaseClient, cooldownHours?: number, now?: Date): Promise<DataResult<RefreshCooldownStatus>>;
/**
 * Inserts a row into price_refresh_log to record a refresh event.
 */
export declare function logRefresh(client: SupabaseClient, trigger: PriceRefreshTrigger, now?: Date): Promise<DataResult<{
    refreshed_at: string;
}>>;
/**
 * Triggers a price refresh by calling the Supabase Edge Function.
 * Used by both the manual button (Story 3.5) and auto-refresh (Story 3.6).
 *
 * @param client - Supabase client (service role for server-side, anon for client)
 * @param trigger - 'manual' or 'auto'
 * @param fetchFn - Injected fetch for testing
 */
export declare function triggerRefresh(client: SupabaseClient, trigger: PriceRefreshTrigger, fetchFn?: typeof fetch): Promise<DataResult<RefreshResult>>;
/**
 * Determines if auto-refresh should trigger on portfolio page entry.
 * Story 3.6: Refresh if cooldown expired (default 4h).
 */
export declare function shouldAutoRefresh(client: SupabaseClient, cooldownHours?: number, now?: Date): Promise<DataResult<RefreshCooldownStatus>>;
/**
 * Creates a debounce guard for manual refresh (1-minute cooldown).
 * Returns a function that checks whether a manual refresh is allowed.
 */
export declare function createManualRefreshGuard(): {
    canRefresh: (now?: number) => boolean;
    markRefreshed: (now?: number) => void;
    getTimeUntilNextMs: (now?: number) => number;
};
//# sourceMappingURL=refresh.d.ts.map