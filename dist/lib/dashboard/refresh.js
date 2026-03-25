// ============================================================
// Nexus Data — Price Refresh Logic
// Handles manual + auto-refresh with cooldown tracking.
// Stories 3.5 (manual button) & 3.6 (auto-refresh on entry).
// ============================================================
// ---------- Constants ----------
const DEFAULT_COOLDOWN_HOURS = 4;
const MANUAL_DEBOUNCE_MS = 60_000; // 1 minute
// ---------- Helpers ----------
function makeError(code, message, details) {
    return { code, message, details };
}
// ---------- getLastRefreshTimestamp ----------
/**
 * Fetches the most recent price_refresh_log entry.
 * Returns null if no entries exist (first-ever visit).
 */
export async function getLastRefreshTimestamp(client) {
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
export async function checkCooldown(client, cooldownHours = DEFAULT_COOLDOWN_HOURS, now = new Date()) {
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
    const hoursSince = (now.getTime() - new Date(lastRefreshedAt).getTime()) / (1000 * 60 * 60);
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
export async function logRefresh(client, trigger, now = new Date()) {
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
export async function triggerRefresh(client, trigger, fetchFn = fetch) {
    const now = new Date();
    try {
        // Call the refresh-prices Edge Function
        const supabaseUrl = client.supabaseUrl;
        if (!supabaseUrl) {
            return {
                data: null,
                error: makeError('PRICE_ERROR', 'Supabase URL not available on client'),
            };
        }
        const response = await fetchFn(`${supabaseUrl}/functions/v1/refresh-prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${client.supabaseKey ?? ''}`,
            },
            body: JSON.stringify({ trigger }),
        });
        if (!response.ok) {
            const text = await response.text();
            return {
                data: null,
                error: makeError('PRICE_ERROR', `Price refresh failed: HTTP ${response.status}`, text),
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
    }
    catch (err) {
        return {
            data: null,
            error: makeError('PRICE_ERROR', err instanceof Error ? err.message : 'Price refresh failed', err),
        };
    }
}
// ---------- shouldAutoRefresh ----------
/**
 * Determines if auto-refresh should trigger on portfolio page entry.
 * Story 3.6: Refresh if cooldown expired (default 4h).
 */
export async function shouldAutoRefresh(client, cooldownHours = DEFAULT_COOLDOWN_HOURS, now = new Date()) {
    return checkCooldown(client, cooldownHours, now);
}
// ---------- Client-side debounce state ----------
/**
 * Creates a debounce guard for manual refresh (1-minute cooldown).
 * Returns a function that checks whether a manual refresh is allowed.
 */
export function createManualRefreshGuard() {
    let lastManualRefresh = -MANUAL_DEBOUNCE_MS;
    return {
        canRefresh(now = Date.now()) {
            return now - lastManualRefresh >= MANUAL_DEBOUNCE_MS;
        },
        markRefreshed(now = Date.now()) {
            lastManualRefresh = now;
        },
        getTimeUntilNextMs(now = Date.now()) {
            const elapsed = now - lastManualRefresh;
            return Math.max(0, MANUAL_DEBOUNCE_MS - elapsed);
        },
    };
}
