// ============================================================
// Nexus Data — Price Refresh Logic
// Handles manual + auto-refresh with cooldown tracking.
// Stories 3.5 (manual button) & 3.6 (auto-refresh on entry).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriceRefreshTrigger } from '../nexus/types.js';
import type { DataResult, DataError } from './types.js';

// ---------- Constants ----------

const DEFAULT_COOLDOWN_HOURS = 4;
const MANUAL_DEBOUNCE_MS = 60_000; // 1 minute

// ---------- Types ----------

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

// ---------- Helpers ----------

function makeError(
  code: DataError['code'],
  message: string,
  details?: unknown,
): DataError {
  return { code, message, details };
}

// ---------- getLastRefreshTimestamp ----------

/**
 * Fetches the most recent price_refresh_log entry.
 * Returns null if no entries exist (first-ever visit).
 */
export async function getLastRefreshTimestamp(
  client: SupabaseClient,
): Promise<DataResult<string | null>> {
  const { data, error } = await client
    .from('price_refresh_log')
    .select('refreshed_at')
    .order('refreshed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to fetch last refresh timestamp', error),
    };
  }

  return {
    data: data?.refreshed_at ?? null,
    error: null,
  };
}

// ---------- checkCooldown ----------

/**
 * Checks whether the auto-refresh cooldown has expired.
 * Returns cooldown status with computed hours since last refresh.
 */
export async function checkCooldown(
  client: SupabaseClient,
  cooldownHours: number = DEFAULT_COOLDOWN_HOURS,
  now: Date = new Date(),
): Promise<DataResult<RefreshCooldownStatus>> {
  const lastResult = await getLastRefreshTimestamp(client);

  if (lastResult.error) {
    return { data: null, error: lastResult.error };
  }

  const lastRefreshedAt = lastResult.data;

  if (lastRefreshedAt === null) {
    // First-ever entry — cooldown expired by definition
    return {
      data: {
        last_refreshed_at: null,
        hours_since_refresh: null,
        cooldown_hours: cooldownHours,
        cooldown_expired: true,
      },
      error: null,
    };
  }

  const hoursSince =
    (now.getTime() - new Date(lastRefreshedAt).getTime()) / (1000 * 60 * 60);

  return {
    data: {
      last_refreshed_at: lastRefreshedAt,
      hours_since_refresh: Math.round(hoursSince * 100) / 100,
      cooldown_hours: cooldownHours,
      cooldown_expired: hoursSince >= cooldownHours,
    },
    error: null,
  };
}

// ---------- logRefresh ----------

/**
 * Inserts a row into price_refresh_log to record a refresh event.
 */
export async function logRefresh(
  client: SupabaseClient,
  trigger: PriceRefreshTrigger,
  now: Date = new Date(),
): Promise<DataResult<{ refreshed_at: string }>> {
  const refreshedAt = now.toISOString();

  const { error } = await client
    .from('price_refresh_log')
    .insert({ refreshed_at: refreshedAt, trigger });

  if (error) {
    return {
      data: null,
      error: makeError('DB_ERROR', 'Failed to log price refresh', error),
    };
  }

  return { data: { refreshed_at: refreshedAt }, error: null };
}

// ---------- triggerRefresh ----------

/**
 * Triggers a price refresh by calling the Supabase Edge Function.
 * Used by both the manual button (Story 3.5) and auto-refresh (Story 3.6).
 *
 * @param client - Supabase client (service role for server-side, anon for client)
 * @param trigger - 'manual' or 'auto'
 * @param fetchFn - Injected fetch for testing
 */
export async function triggerRefresh(
  client: SupabaseClient,
  trigger: PriceRefreshTrigger,
  fetchFn: typeof fetch = fetch,
): Promise<DataResult<RefreshResult>> {
  const now = new Date();

  try {
    // Call the refresh-prices Edge Function
    const supabaseUrl = (client as unknown as { supabaseUrl?: string }).supabaseUrl;
    if (!supabaseUrl) {
      return {
        data: null,
        error: makeError('PRICE_ERROR', 'Supabase URL not available on client'),
      };
    }

    const response = await fetchFn(
      `${supabaseUrl}/functions/v1/refresh-prices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(client as unknown as { supabaseKey?: string }).supabaseKey ?? ''}`,
        },
        body: JSON.stringify({ trigger }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        data: null,
        error: makeError(
          'PRICE_ERROR',
          `Price refresh failed: HTTP ${response.status}`,
          text,
        ),
      };
    }

    // Log the refresh
    const logResult = await logRefresh(client, trigger, now);
    if (logResult.error) {
      // Refresh succeeded but logging failed — still report success
      // but the cooldown check may re-trigger on next visit
    }

    return {
      data: {
        triggered: true,
        trigger,
        refreshed_at: now.toISOString(),
        skipped_reason: null,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: makeError(
        'PRICE_ERROR',
        err instanceof Error ? err.message : 'Price refresh failed',
        err,
      ),
    };
  }
}

// ---------- shouldAutoRefresh ----------

/**
 * Determines if auto-refresh should trigger on portfolio page entry.
 * Story 3.6: Refresh if cooldown expired (default 4h).
 */
export async function shouldAutoRefresh(
  client: SupabaseClient,
  cooldownHours: number = DEFAULT_COOLDOWN_HOURS,
  now: Date = new Date(),
): Promise<DataResult<RefreshCooldownStatus>> {
  return checkCooldown(client, cooldownHours, now);
}

// ---------- Client-side debounce state ----------

/**
 * Creates a debounce guard for manual refresh (1-minute cooldown).
 * Returns a function that checks whether a manual refresh is allowed.
 */
export function createManualRefreshGuard(): {
  canRefresh: (now?: number) => boolean;
  markRefreshed: (now?: number) => void;
  getTimeUntilNextMs: (now?: number) => number;
} {
  let lastManualRefresh = -MANUAL_DEBOUNCE_MS;

  return {
    canRefresh(now: number = Date.now()): boolean {
      return now - lastManualRefresh >= MANUAL_DEBOUNCE_MS;
    },
    markRefreshed(now: number = Date.now()): void {
      lastManualRefresh = now;
    },
    getTimeUntilNextMs(now: number = Date.now()): number {
      const elapsed = now - lastManualRefresh;
      return Math.max(0, MANUAL_DEBOUNCE_MS - elapsed);
    },
  };
}
