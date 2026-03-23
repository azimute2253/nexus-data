import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PriceRefreshTrigger } from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────

type TableDataMap = Record<string, { data: unknown; error: unknown }>;
type InsertCapture = { table: string; rows: unknown[] };

function createMockClient(tableData: TableDataMap = {}) {
  const insertCaptures: InsertCapture[] = [];

  const client = {
    from(table: string) {
      const result = tableData[table] ?? { data: null, error: null };
      const chain: Record<string, unknown> = {};

      const chainMethods = ['select', 'eq', 'order', 'limit'];

      for (const method of chainMethods) {
        chain[method] = vi.fn((..._args: unknown[]) => chain);
      }

      chain.insert = vi.fn((rows: unknown) => {
        insertCaptures.push({ table, rows: Array.isArray(rows) ? rows : [rows] });
        return { data: null, error: result.error };
      });

      chain.maybeSingle = vi.fn(() => {
        const d = result.data;
        const singleData = Array.isArray(d) ? (d[0] ?? null) : d;
        return { data: singleData, error: result.error };
      });

      chain.single = vi.fn(() => {
        const d = result.data;
        const singleData = Array.isArray(d) ? (d[0] ?? null) : d;
        return { data: singleData, error: result.error };
      });

      // Make chain thenable for non-terminal awaits
      chain.then = (resolve: (val: unknown) => void) =>
        Promise.resolve(result).then(resolve);

      return chain;
    },
    _insertCaptures: insertCaptures,
  };

  return client;
}

// ── Import SUT ──────────────────────────────────────────────

import {
  getLastRefreshTimestamp,
  checkCooldown,
  logRefresh,
  shouldAutoRefresh,
  createManualRefreshGuard,
} from '../../src/lib/dashboard/refresh.js';

// ============================================================
// Story 3.6 — Auto-refresh cooldown logic
// ============================================================

describe('getLastRefreshTimestamp', () => {
  it('returns null when no rows exist (first-ever entry)', async () => {
    const client = createMockClient({
      price_refresh_log: { data: null, error: null },
    });

    const result = await getLastRefreshTimestamp(client as never);
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('returns the most recent refreshed_at', async () => {
    const ts = '2026-03-22T10:00:00.000Z';
    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: ts }],
        error: null,
      },
    });

    const result = await getLastRefreshTimestamp(client as never);
    expect(result.error).toBeNull();
    expect(result.data).toBe(ts);
  });

  it('returns error when DB query fails', async () => {
    const client = createMockClient({
      price_refresh_log: {
        data: null,
        error: { message: 'connection refused' },
      },
    });

    const result = await getLastRefreshTimestamp(client as never);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.code).toBe('DB_ERROR');
  });
});

describe('checkCooldown', () => {
  it('returns cooldown_expired=true when no previous refresh exists', async () => {
    const client = createMockClient({
      price_refresh_log: { data: null, error: null },
    });

    const result = await checkCooldown(client as never, 4);
    expect(result.error).toBeNull();
    expect(result.data!.cooldown_expired).toBe(true);
    expect(result.data!.last_refreshed_at).toBeNull();
    expect(result.data!.hours_since_refresh).toBeNull();
  });

  it('returns cooldown_expired=true when last refresh was 5 hours ago', async () => {
    const now = new Date('2026-03-22T15:00:00.000Z');
    const lastRefresh = new Date('2026-03-22T10:00:00.000Z'); // 5 hours ago

    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: lastRefresh.toISOString() }],
        error: null,
      },
    });

    const result = await checkCooldown(client as never, 4, now);
    expect(result.error).toBeNull();
    expect(result.data!.cooldown_expired).toBe(true);
    expect(result.data!.hours_since_refresh).toBe(5);
    expect(result.data!.cooldown_hours).toBe(4);
  });

  it('returns cooldown_expired=false when last refresh was 2 hours ago', async () => {
    const now = new Date('2026-03-22T12:00:00.000Z');
    const lastRefresh = new Date('2026-03-22T10:00:00.000Z'); // 2 hours ago

    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: lastRefresh.toISOString() }],
        error: null,
      },
    });

    const result = await checkCooldown(client as never, 4, now);
    expect(result.error).toBeNull();
    expect(result.data!.cooldown_expired).toBe(false);
    expect(result.data!.hours_since_refresh).toBe(2);
  });

  it('respects custom cooldown hours', async () => {
    const now = new Date('2026-03-22T12:00:00.000Z');
    const lastRefresh = new Date('2026-03-22T10:00:00.000Z'); // 2 hours ago

    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: lastRefresh.toISOString() }],
        error: null,
      },
    });

    // 1-hour cooldown → 2 hours elapsed → expired
    const result = await checkCooldown(client as never, 1, now);
    expect(result.data!.cooldown_expired).toBe(true);
  });

  it('uses default 4-hour cooldown when not specified', async () => {
    const now = new Date('2026-03-22T13:00:00.000Z');
    const lastRefresh = new Date('2026-03-22T10:00:00.000Z'); // 3 hours ago

    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: lastRefresh.toISOString() }],
        error: null,
      },
    });

    const result = await checkCooldown(client as never, undefined, now);
    expect(result.data!.cooldown_expired).toBe(false);
    expect(result.data!.cooldown_hours).toBe(4);
  });
});

describe('logRefresh', () => {
  it('inserts a row with trigger type and timestamp', async () => {
    const client = createMockClient({
      price_refresh_log: { data: null, error: null },
    });

    const now = new Date('2026-03-22T14:00:00.000Z');
    const result = await logRefresh(client as never, 'manual', now);

    expect(result.error).toBeNull();
    expect(result.data!.refreshed_at).toBe(now.toISOString());
    expect(client._insertCaptures).toHaveLength(1);
    expect(client._insertCaptures[0].table).toBe('price_refresh_log');
    expect(client._insertCaptures[0].rows[0]).toEqual({
      refreshed_at: now.toISOString(),
      trigger: 'manual',
    });
  });

  it('logs auto trigger type', async () => {
    const client = createMockClient({
      price_refresh_log: { data: null, error: null },
    });

    const now = new Date('2026-03-22T14:00:00.000Z');
    await logRefresh(client as never, 'auto', now);

    expect(client._insertCaptures[0].rows[0]).toEqual(
      expect.objectContaining({ trigger: 'auto' }),
    );
  });

  it('returns error when insert fails', async () => {
    const client = createMockClient({
      price_refresh_log: {
        data: null,
        error: { message: 'insert failed' },
      },
    });

    const result = await logRefresh(client as never, 'manual');
    expect(result.data).toBeNull();
    expect(result.error!.code).toBe('DB_ERROR');
  });
});

describe('shouldAutoRefresh', () => {
  it('delegates to checkCooldown with correct parameters', async () => {
    const now = new Date('2026-03-22T15:00:00.000Z');
    const lastRefresh = new Date('2026-03-22T10:00:00.000Z');

    const client = createMockClient({
      price_refresh_log: {
        data: [{ refreshed_at: lastRefresh.toISOString() }],
        error: null,
      },
    });

    const result = await shouldAutoRefresh(client as never, 4, now);
    expect(result.error).toBeNull();
    expect(result.data!.cooldown_expired).toBe(true);
  });

  it('returns cooldown_expired=true for first-ever entry', async () => {
    const client = createMockClient({
      price_refresh_log: { data: null, error: null },
    });

    const result = await shouldAutoRefresh(client as never);
    expect(result.data!.cooldown_expired).toBe(true);
  });
});

// ============================================================
// Story 3.5 — Manual refresh debounce guard
// ============================================================

describe('createManualRefreshGuard', () => {
  it('allows first refresh immediately', () => {
    const guard = createManualRefreshGuard();
    expect(guard.canRefresh(1000)).toBe(true);
  });

  it('blocks refresh within 1 minute of last refresh', () => {
    const guard = createManualRefreshGuard();
    const t0 = 1000;

    guard.markRefreshed(t0);
    expect(guard.canRefresh(t0 + 30_000)).toBe(false); // 30s later
    expect(guard.canRefresh(t0 + 59_999)).toBe(false); // 59.999s later
  });

  it('allows refresh after 1 minute', () => {
    const guard = createManualRefreshGuard();
    const t0 = 1000;

    guard.markRefreshed(t0);
    expect(guard.canRefresh(t0 + 60_000)).toBe(true); // exactly 60s
    expect(guard.canRefresh(t0 + 90_000)).toBe(true); // 90s
  });

  it('reports correct time until next allowed refresh', () => {
    const guard = createManualRefreshGuard();
    const t0 = 1000;

    guard.markRefreshed(t0);
    expect(guard.getTimeUntilNextMs(t0 + 30_000)).toBe(30_000); // 30s remaining
    expect(guard.getTimeUntilNextMs(t0 + 60_000)).toBe(0); // no wait
    expect(guard.getTimeUntilNextMs(t0 + 90_000)).toBe(0); // past cooldown
  });

  it('resets cooldown on each markRefreshed call', () => {
    const guard = createManualRefreshGuard();

    guard.markRefreshed(1000);
    expect(guard.canRefresh(61_000)).toBe(true); // 60s after first

    guard.markRefreshed(61_000); // refresh again
    expect(guard.canRefresh(90_000)).toBe(false); // only 29s after second
    expect(guard.canRefresh(121_000)).toBe(true); // 60s after second
  });
});
