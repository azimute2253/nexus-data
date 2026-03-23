import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FeatureFlag } from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────

const { queryBuilder, setMockResult } = vi.hoisted(() => {
  interface MockResult { data: unknown; error: unknown }

  let mockResult: MockResult = { data: null, error: null };

  function setMockResult(result: Partial<MockResult>) {
    mockResult = { data: null, error: null, ...result };
  }

  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'order', 'single', 'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => {
      if (['single', 'maybeSingle'].includes(method)) {
        return { ...mockResult };
      }
      return builder;
    });
  }

  // Make builder thenable so await on non-terminal chains works
  (builder as Record<string, unknown>).then = (
    resolve: (val: MockResult) => void,
  ) => Promise.resolve(mockResult).then(resolve);

  return { queryBuilder: builder, setMockResult };
});

vi.mock('../../src/lib/supabase.js', () => ({
  getAnonClient: () => queryBuilder,
}));

// ── Import module under test ────────────────────────────────

import {
  getFeatureFlags,
  getFeatureFlag,
  isFeatureEnabled,
  setFeatureFlag,
  toggleFeatureFlag,
  deleteFeatureFlag,
} from '../../src/lib/feature-flags/client.js';

// ── Fixtures ────────────────────────────────────────────────

function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    name: 'portfolio_dashboard',
    enabled: false,
    description: 'Show/hide portfolio dashboard page',
    ...overrides,
  };
}

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  setMockResult({ data: null, error: null });
  vi.clearAllMocks();

  for (const method of Object.keys(queryBuilder)) {
    if (method === 'then') continue;
    queryBuilder[method].mockImplementation(() => {
      if (['single', 'maybeSingle'].includes(method)) {
        return { data: null, error: null };
      }
      return queryBuilder;
    });
  }
});

// ── Tests ───────────────────────────────────────────────────

// ---------- getFeatureFlags (list all) ----------

describe('getFeatureFlags', () => {
  it('returns all flags ordered by name', async () => {
    const flags = [
      makeFlag({ name: 'portfolio_dashboard' }),
      makeFlag({ name: 'price_refresh_manual' }),
      makeFlag({ name: 'rebalancing_calculator' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: flags, error: null });

    const result = await getFeatureFlags();

    expect(queryBuilder.from).toHaveBeenCalledWith('feature_flags');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(queryBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(result).toEqual(flags);
  });

  it('returns empty array when no flags exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getFeatureFlags();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getFeatureFlags()).rejects.toEqual(err);
  });
});

// ---------- getFeatureFlag (single by name) ----------

describe('getFeatureFlag', () => {
  it('returns a single flag by name', async () => {
    const flag = makeFlag();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: flag, error: null });

    const result = await getFeatureFlag('portfolio_dashboard');

    expect(queryBuilder.from).toHaveBeenCalledWith('feature_flags');
    expect(queryBuilder.eq).toHaveBeenCalledWith('name', 'portfolio_dashboard');
    expect(result).toEqual(flag);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getFeatureFlag('nonexistent');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getFeatureFlag('any')).rejects.toEqual(err);
  });
});

// ---------- isFeatureEnabled ----------

describe('isFeatureEnabled', () => {
  it('AC4 — returns true when flag is enabled', async () => {
    const flag = makeFlag({ enabled: true });
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: flag, error: null });

    const result = await isFeatureEnabled('portfolio_dashboard');
    expect(result).toBe(true);
  });

  it('AC4 — returns false when flag is disabled', async () => {
    const flag = makeFlag({ enabled: false });
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: flag, error: null });

    const result = await isFeatureEnabled('portfolio_dashboard');
    expect(result).toBe(false);
  });

  it('AC4 — returns false when flag does not exist', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await isFeatureEnabled('nonexistent_flag');
    expect(result).toBe(false);
  });
});

// ---------- setFeatureFlag (upsert) ----------

describe('setFeatureFlag', () => {
  it('AC3 — creates/updates a flag with enabled state', async () => {
    const flag = makeFlag({ enabled: true });
    queryBuilder.single.mockReturnValueOnce({ data: flag, error: null });

    const result = await setFeatureFlag('portfolio_dashboard', true, 'Show/hide portfolio dashboard page');

    expect(queryBuilder.from).toHaveBeenCalledWith('feature_flags');
    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      { name: 'portfolio_dashboard', enabled: true, description: 'Show/hide portfolio dashboard page' },
      { onConflict: 'name' },
    );
    expect(result).toEqual(flag);
  });

  it('trims name before saving', async () => {
    const flag = makeFlag({ name: 'my_flag' });
    queryBuilder.single.mockReturnValueOnce({ data: flag, error: null });

    await setFeatureFlag('  my_flag  ', false);

    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my_flag' }),
      expect.any(Object),
    );
  });

  it('sets description to null when omitted', async () => {
    const flag = makeFlag({ description: null });
    queryBuilder.single.mockReturnValueOnce({ data: flag, error: null });

    await setFeatureFlag('portfolio_dashboard', false);

    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
      expect.any(Object),
    );
  });

  it('validation: rejects empty name', async () => {
    await expect(setFeatureFlag('', true)).rejects.toThrow('Feature flag name is required');
  });

  it('validation: rejects whitespace-only name', async () => {
    await expect(setFeatureFlag('   ', true)).rejects.toThrow('Feature flag name is required');
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'permission denied', code: '42501' };
    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(setFeatureFlag('test', true)).rejects.toEqual(err);
  });
});

// ---------- toggleFeatureFlag ----------

describe('toggleFeatureFlag', () => {
  it('AC3 — toggles flag from false to true', async () => {
    const original = makeFlag({ enabled: false });
    const toggled = makeFlag({ enabled: true });

    // First call: getFeatureFlag (maybeSingle)
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: original, error: null });
    // Second call: update (single)
    queryBuilder.single.mockReturnValueOnce({ data: toggled, error: null });

    const result = await toggleFeatureFlag('portfolio_dashboard');

    expect(queryBuilder.update).toHaveBeenCalledWith({ enabled: true });
    expect(result.enabled).toBe(true);
  });

  it('AC3 — toggles flag from true to false', async () => {
    const original = makeFlag({ enabled: true });
    const toggled = makeFlag({ enabled: false });

    queryBuilder.maybeSingle.mockReturnValueOnce({ data: original, error: null });
    queryBuilder.single.mockReturnValueOnce({ data: toggled, error: null });

    const result = await toggleFeatureFlag('portfolio_dashboard');

    expect(queryBuilder.update).toHaveBeenCalledWith({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('throws when flag does not exist', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    await expect(toggleFeatureFlag('nonexistent')).rejects.toThrow(
      'Feature flag not found: nonexistent',
    );
  });
});

// ---------- deleteFeatureFlag ----------

describe('deleteFeatureFlag', () => {
  it('deletes a flag by name', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteFeatureFlag('portfolio_dashboard')).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('feature_flags');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('name', 'portfolio_dashboard');
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteFeatureFlag('any')).rejects.toEqual(err);
  });
});
