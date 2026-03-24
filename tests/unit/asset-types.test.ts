import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AssetType, AssetTypeInsert } from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────
// Use vi.hoisted so the mock factory can reference our builder.

const { queryBuilder, setMockResult } = vi.hoisted(() => {
  interface MockResult { data: unknown; error: unknown }

  let mockResult: MockResult = { data: null, error: null };

  function setMockResult(result: Partial<MockResult>) {
    mockResult = { data: null, error: null, ...result };
  }

  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    'from', 'select', 'insert', 'update', 'delete',
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
  getAssetTypes,
  getAssetType,
  createAssetType,
  updateAssetType,
  deleteAssetType,
} from '../../src/lib/nexus/asset-types.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ID = '00000000-0000-0000-0000-000000000099';

function makeAssetType(overrides: Partial<AssetType> = {}): AssetType {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'FIIs',
    target_pct: 15,
    sort_order: 1,
    user_id: USER_ID,
    wallet_id: WALLET_ID,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  setMockResult({ data: null, error: null });
  vi.clearAllMocks();

  // Restore default chain behavior after clearAllMocks
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

// ---------- getAssetTypes (list all) ----------

describe('getAssetTypes', () => {
  it('T6.1.1 — returns all asset types ordered by sort_order', async () => {
    const types = [
      makeAssetType({ sort_order: 1, name: 'FIIs' }),
      makeAssetType({ sort_order: 2, name: 'Ações BR' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: types, error: null });

    const result = await getAssetTypes();

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_types');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(queryBuilder.order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(result).toEqual(types);
  });

  it('returns empty array when no types exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getAssetTypes();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getAssetTypes()).rejects.toEqual(err);
  });
});

// ---------- getAssetType (single by ID) ----------

describe('getAssetType', () => {
  it('T6.1.3 — returns a single asset type by ID', async () => {
    const type = makeAssetType();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: type, error: null });

    const result = await getAssetType(type.id);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_types');
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', type.id);
    expect(result).toEqual(type);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getAssetType('nonexistent-id');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getAssetType('any-id')).rejects.toEqual(err);
  });
});

// ---------- createAssetType ----------

describe('createAssetType', () => {
  it('T6.1.2 — creates an asset type with name and target_pct', async () => {
    const input: AssetTypeInsert = {
      name: 'Crypto',
      target_pct: 3,
      sort_order: 11,
      user_id: USER_ID,
    };
    const created = makeAssetType({ name: 'Crypto', target_pct: 3, sort_order: 11 });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createAssetType(input);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_types');
    expect(queryBuilder.insert).toHaveBeenCalledWith(input);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('validation: rejects empty name', async () => {
    const input: AssetTypeInsert = {
      name: '',
      target_pct: 5,
      sort_order: 1,
      user_id: USER_ID,
    };

    await expect(createAssetType(input)).rejects.toThrow('Asset type name is required');
  });

  it('validation: rejects whitespace-only name', async () => {
    const input: AssetTypeInsert = {
      name: '   ',
      target_pct: 5,
      sort_order: 1,
      user_id: USER_ID,
    };

    await expect(createAssetType(input)).rejects.toThrow('Asset type name is required');
  });

  it('throws on Supabase error (e.g. duplicate name)', async () => {
    const input: AssetTypeInsert = {
      name: 'FIIs',
      target_pct: 15,
      sort_order: 1,
      user_id: USER_ID,
    };
    const err = { message: 'duplicate key', code: '23505' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createAssetType(input)).rejects.toEqual(err);
  });
});

// ---------- updateAssetType ----------

describe('updateAssetType', () => {
  it('T6.1.4 — updates target_pct for an asset type', async () => {
    const updated = makeAssetType({ target_pct: 12 });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAssetType(updated.id, { target_pct: 12 });

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_types');
    expect(queryBuilder.update).toHaveBeenCalledWith({ target_pct: 12 });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', updated.id);
    expect(result.target_pct).toBe(12);
  });

  it('updates name for an asset type', async () => {
    const updated = makeAssetType({ name: 'REITs' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAssetType(updated.id, { name: 'REITs' });
    expect(result.name).toBe('REITs');
  });

  it('validation: rejects empty update object', async () => {
    await expect(updateAssetType('any-id', {})).rejects.toThrow(
      'At least one field must be provided for update',
    );
  });

  it('validation: rejects empty name in update', async () => {
    await expect(updateAssetType('any-id', { name: '' })).rejects.toThrow(
      'Asset type name cannot be empty',
    );
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'not found', code: 'PGRST116' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(updateAssetType('bad-id', { name: 'Test' })).rejects.toEqual(err);
  });
});

// ---------- deleteAssetType ----------

describe('deleteAssetType', () => {
  it('T6.1.5 — deletes an asset type by ID', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteAssetType('some-id')).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_types');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'some-id');
  });

  it('throws on Supabase error (e.g. FK constraint)', async () => {
    const err = { message: 'foreign key constraint', code: '23503' };

    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteAssetType('used-id')).rejects.toEqual(err);
  });
});
