import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Asset, AssetInsert } from '../../src/lib/nexus/types.js';

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
  getAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
} from '../../src/lib/nexus/assets.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ID = '00000000-0000-0000-0000-000000000099';
const GROUP_ID = '33333333-3333-3333-3333-333333333333';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    ticker: 'VALE3',
    name: 'Vale S.A.',
    sector: 'Mineração',
    quantity: 100,
    group_id: GROUP_ID,
    price_source: 'brapi',
    is_active: true,
    manual_override: false,
    whole_shares: true,
    bought: false,
    sold: false,
    weight_mode: 'questionnaire',
    manual_weight: 0,
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

// ---------- getAssets (list all / filter by group) ----------

describe('getAssets', () => {
  it('T6.3.1 — returns all assets ordered by ticker', async () => {
    const assets = [
      makeAsset({ ticker: 'ITUB4' }),
      makeAsset({ ticker: 'VALE3', id: '55555555-5555-5555-5555-555555555555' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: assets, error: null });

    const result = await getAssets(WALLET_ID);

    expect(queryBuilder.from).toHaveBeenCalledWith('assets');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(queryBuilder.eq).toHaveBeenCalledWith('wallet_id', WALLET_ID);
    expect(queryBuilder.order).toHaveBeenCalledWith('ticker', { ascending: true });
    expect(result).toEqual(assets);
  });

  it('T6.3.2 — filters assets by group_id', async () => {
    const assets = [makeAsset()];

    queryBuilder.order.mockReturnValueOnce({ data: assets, error: null });

    const result = await getAssets(WALLET_ID, GROUP_ID);

    expect(queryBuilder.eq).toHaveBeenCalledWith('wallet_id', WALLET_ID);
    expect(queryBuilder.eq).toHaveBeenCalledWith('group_id', GROUP_ID);
    expect(result).toEqual(assets);
  });

  it('returns empty array when no assets exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getAssets(WALLET_ID);
    expect(result).toEqual([]);
  });

  it('T6.4.7 — returns bought/sold flags in asset data', async () => {
    const assets = [
      makeAsset({ ticker: 'VALE3', bought: true, sold: false }),
      makeAsset({ ticker: 'PETR4', id: '55555555-5555-5555-5555-555555555555', bought: false, sold: true }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: assets, error: null });

    const result = await getAssets(WALLET_ID);
    expect(result[0].bought).toBe(true);
    expect(result[0].sold).toBe(false);
    expect(result[1].bought).toBe(false);
    expect(result[1].sold).toBe(true);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getAssets(WALLET_ID)).rejects.toEqual(err);
  });
});

// ---------- getAsset (single by ID) ----------

describe('getAsset', () => {
  it('T6.3.3 — returns a single asset by ID', async () => {
    const asset = makeAsset();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: asset, error: null });

    const result = await getAsset(asset.id);

    expect(queryBuilder.from).toHaveBeenCalledWith('assets');
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', asset.id);
    expect(result).toEqual(asset);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getAsset('nonexistent-id');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getAsset('any-id')).rejects.toEqual(err);
  });
});

// ---------- createAsset ----------

describe('createAsset', () => {
  it('T6.3.4 — creates an asset with all fields', async () => {
    const input: AssetInsert = {
      ticker: 'MGLU3',
      name: 'Magazine Luiza',
      sector: 'Varejo',
      quantity: 50,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };
    const created = makeAsset({
      ticker: 'MGLU3',
      name: 'Magazine Luiza',
      sector: 'Varejo',
      quantity: 50,
    });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createAsset(input);

    expect(queryBuilder.from).toHaveBeenCalledWith('assets');
    expect(queryBuilder.insert).toHaveBeenCalledWith(input);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('creates an asset with quantity 0', async () => {
    const input: AssetInsert = {
      ticker: 'PETR4',
      name: 'Petrobras',
      sector: 'Energia',
      quantity: 0,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };
    const created = makeAsset({ ticker: 'PETR4', quantity: 0 });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createAsset(input);
    expect(result.quantity).toBe(0);
  });

  it('validation: rejects empty ticker', async () => {
    const input: AssetInsert = {
      ticker: '',
      name: null,
      sector: null,
      quantity: 10,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow('Ticker is required');
  });

  it('validation: rejects whitespace-only ticker', async () => {
    const input: AssetInsert = {
      ticker: '   ',
      name: null,
      sector: null,
      quantity: 10,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow('Ticker is required');
  });

  it('validation: rejects missing group_id', async () => {
    const input: AssetInsert = {
      ticker: 'VALE3',
      name: null,
      sector: null,
      quantity: 10,
      group_id: '',
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow('group_id is required');
  });

  it('validation: rejects negative quantity', async () => {
    const input: AssetInsert = {
      ticker: 'VALE3',
      name: null,
      sector: null,
      quantity: -5,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow('Quantity must be >= 0');
  });

  it('validation: rejects invalid price_source', async () => {
    const input: AssetInsert = {
      ticker: 'VALE3',
      name: null,
      sector: null,
      quantity: 10,
      group_id: GROUP_ID,
      price_source: 'invalid' as 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow('Invalid price_source');
  });

  it('throws on Supabase error (e.g. duplicate ticker)', async () => {
    const input: AssetInsert = {
      ticker: 'VALE3',
      name: null,
      sector: null,
      quantity: 10,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };
    const err = { message: 'duplicate key value violates unique constraint "assets_ticker_user_unique"', code: '23505' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createAsset(input)).rejects.toEqual(err);
  });

  it('T6.4.6 — rejects createAsset with bought=true and sold=true', async () => {
    const input: AssetInsert = {
      ticker: 'VALE3',
      name: null,
      sector: null,
      quantity: 10,
      group_id: GROUP_ID,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: true,
      sold: true,
      user_id: USER_ID,
    };

    await expect(createAsset(input)).rejects.toThrow(
      'Asset cannot be both bought and sold',
    );
  });

  it('throws on Supabase error (e.g. invalid FK group_id)', async () => {
    const input: AssetInsert = {
      ticker: 'TEST',
      name: null,
      sector: null,
      quantity: 10,
      group_id: 'nonexistent-group-id',
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
      bought: false,
      sold: false,
      user_id: USER_ID,
    };
    const err = { message: 'foreign key constraint', code: '23503' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createAsset(input)).rejects.toEqual(err);
  });
});

// ---------- updateAsset ----------

describe('updateAsset', () => {
  it('T6.3.5 — updates ticker for an asset', async () => {
    const updated = makeAsset({ ticker: 'VALE5' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { ticker: 'VALE5' });

    expect(queryBuilder.from).toHaveBeenCalledWith('assets');
    expect(queryBuilder.update).toHaveBeenCalledWith({ ticker: 'VALE5' });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', updated.id);
    expect(result.ticker).toBe('VALE5');
  });

  it('updates quantity for an asset', async () => {
    const updated = makeAsset({ quantity: 200 });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { quantity: 200 });
    expect(result.quantity).toBe(200);
  });

  it('updates quantity to 0', async () => {
    const updated = makeAsset({ quantity: 0 });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { quantity: 0 });
    expect(result.quantity).toBe(0);
  });

  it('updates group_id for an asset', async () => {
    const newGroupId = '66666666-6666-6666-6666-666666666666';
    const updated = makeAsset({ group_id: newGroupId });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { group_id: newGroupId });
    expect(result.group_id).toBe(newGroupId);
  });

  it('updates price_source for an asset', async () => {
    const updated = makeAsset({ price_source: 'yahoo' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { price_source: 'yahoo' });
    expect(result.price_source).toBe('yahoo');
  });

  it('updates is_active for an asset', async () => {
    const updated = makeAsset({ is_active: false });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { is_active: false });
    expect(result.is_active).toBe(false);
  });

  // ---------- bought/sold flags (Story 6.4) ----------

  it('T6.4.1 — sets bought flag to true', async () => {
    const updated = makeAsset({ bought: true });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { bought: true });
    expect(result.bought).toBe(true);
    expect(result.sold).toBe(false);
  });

  it('T6.4.2 — sets sold flag to true', async () => {
    const updated = makeAsset({ sold: true });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { sold: true });
    expect(result.sold).toBe(true);
    expect(result.bought).toBe(false);
  });

  it('T6.4.3 — rejects bought=true and sold=true simultaneously', async () => {
    await expect(
      updateAsset('any-id', { bought: true, sold: true }),
    ).rejects.toThrow('Asset cannot be both bought and sold');
  });

  it('T6.4.4 — allows resetting both flags to false', async () => {
    const updated = makeAsset({ bought: false, sold: false });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { bought: false, sold: false });
    expect(result.bought).toBe(false);
    expect(result.sold).toBe(false);
  });

  it('T6.4.5 — allows bought=true with sold=false', async () => {
    const updated = makeAsset({ bought: true, sold: false });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, { bought: true, sold: false });
    expect(result.bought).toBe(true);
    expect(result.sold).toBe(false);
  });

  it('updates multiple fields at once', async () => {
    const updated = makeAsset({ name: 'Vale SA', sector: 'Mining', quantity: 150 });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateAsset(updated.id, {
      name: 'Vale SA',
      sector: 'Mining',
      quantity: 150,
    });
    expect(result.name).toBe('Vale SA');
    expect(result.sector).toBe('Mining');
    expect(result.quantity).toBe(150);
  });

  it('validation: rejects empty update object', async () => {
    await expect(updateAsset('any-id', {})).rejects.toThrow(
      'At least one field must be provided for update',
    );
  });

  it('validation: rejects empty ticker in update', async () => {
    await expect(updateAsset('any-id', { ticker: '' })).rejects.toThrow(
      'Ticker cannot be empty',
    );
  });

  it('validation: rejects whitespace-only ticker in update', async () => {
    await expect(updateAsset('any-id', { ticker: '   ' })).rejects.toThrow(
      'Ticker cannot be empty',
    );
  });

  it('validation: rejects negative quantity in update', async () => {
    await expect(updateAsset('any-id', { quantity: -1 })).rejects.toThrow(
      'Quantity must be >= 0',
    );
  });

  it('validation: rejects invalid price_source in update', async () => {
    await expect(
      updateAsset('any-id', { price_source: 'invalid' as 'brapi' }),
    ).rejects.toThrow('Invalid price_source');
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'not found', code: 'PGRST116' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(updateAsset('bad-id', { name: 'Test' })).rejects.toEqual(err);
  });
});

// ---------- deleteAsset ----------

describe('deleteAsset', () => {
  it('T6.3.6 — deletes an asset by ID', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteAsset('some-id')).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('assets');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'some-id');
  });

  it('throws on Supabase error (e.g. FK constraint from asset_scores)', async () => {
    const err = { message: 'foreign key constraint', code: '23503' };

    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteAsset('used-id')).rejects.toEqual(err);
  });
});
