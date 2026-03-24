import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AssetGroup, AssetGroupInsert } from '../../src/lib/nexus/types.js';

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
  getGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../../src/lib/nexus/groups.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ID = '00000000-0000-0000-0000-000000000099';
const TYPE_ID = '22222222-2222-2222-2222-222222222222';

function makeGroup(overrides: Partial<AssetGroup> = {}): AssetGroup {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    type_id: TYPE_ID,
    name: 'Blue Chips',
    target_pct: 60,
    scoring_method: 'bazin',
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

// ---------- getGroups (list all / filter by type) ----------

describe('getGroups', () => {
  it('T6.2.1 — returns all groups ordered by name', async () => {
    const groups = [
      makeGroup({ name: 'Blue Chips' }),
      makeGroup({ name: 'Small Caps', id: '44444444-4444-4444-4444-444444444444' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: groups, error: null });

    const result = await getGroups();

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_groups');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(queryBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(result).toEqual(groups);
  });

  it('T6.2.2 — filters groups by type_id', async () => {
    const groups = [makeGroup()];

    queryBuilder.order.mockReturnValueOnce({ data: groups, error: null });

    const result = await getGroups(TYPE_ID);

    expect(queryBuilder.eq).toHaveBeenCalledWith('type_id', TYPE_ID);
    expect(result).toEqual(groups);
  });

  it('returns empty array when no groups exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getGroups();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getGroups()).rejects.toEqual(err);
  });
});

// ---------- getGroup (single by ID) ----------

describe('getGroup', () => {
  it('T6.2.3 — returns a single group by ID', async () => {
    const group = makeGroup();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: group, error: null });

    const result = await getGroup(group.id);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_groups');
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', group.id);
    expect(result).toEqual(group);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getGroup('nonexistent-id');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getGroup('any-id')).rejects.toEqual(err);
  });
});

// ---------- createGroup ----------

describe('createGroup', () => {
  it('T6.2.4 — creates a group with name and type_id', async () => {
    const input: AssetGroupInsert = {
      name: 'Dividendos',
      type_id: TYPE_ID,
      target_pct: 40,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };
    const created = makeGroup({ name: 'Dividendos', target_pct: 40 });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createGroup(input);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_groups');
    expect(queryBuilder.insert).toHaveBeenCalledWith(input);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('validation: rejects empty name', async () => {
    const input: AssetGroupInsert = {
      name: '',
      type_id: TYPE_ID,
      target_pct: 10,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };

    await expect(createGroup(input)).rejects.toThrow('Group name is required');
  });

  it('validation: rejects whitespace-only name', async () => {
    const input: AssetGroupInsert = {
      name: '   ',
      type_id: TYPE_ID,
      target_pct: 10,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };

    await expect(createGroup(input)).rejects.toThrow('Group name is required');
  });

  it('validation: rejects null name', async () => {
    const input: AssetGroupInsert = {
      name: null,
      type_id: TYPE_ID,
      target_pct: 10,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };

    await expect(createGroup(input)).rejects.toThrow('Group name is required');
  });

  it('validation: rejects missing type_id', async () => {
    const input: AssetGroupInsert = {
      name: 'Test',
      type_id: '',
      target_pct: 10,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };

    await expect(createGroup(input)).rejects.toThrow('type_id is required');
  });

  it('throws on Supabase error (e.g. duplicate name within type)', async () => {
    const input: AssetGroupInsert = {
      name: 'Blue Chips',
      type_id: TYPE_ID,
      target_pct: 60,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };
    const err = { message: 'duplicate key value violates unique constraint', code: '23505' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createGroup(input)).rejects.toEqual(err);
  });

  it('throws on Supabase error (e.g. invalid FK type_id)', async () => {
    const input: AssetGroupInsert = {
      name: 'Test Group',
      type_id: 'nonexistent-type-id',
      target_pct: 10,
      scoring_method: 'bazin',
      user_id: USER_ID,
    };
    const err = { message: 'foreign key constraint', code: '23503' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createGroup(input)).rejects.toEqual(err);
  });
});

// ---------- updateGroup ----------

describe('updateGroup', () => {
  it('T6.2.5 — updates name for a group', async () => {
    const updated = makeGroup({ name: 'Growth Stocks' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateGroup(updated.id, { name: 'Growth Stocks' });

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_groups');
    expect(queryBuilder.update).toHaveBeenCalledWith({ name: 'Growth Stocks' });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', updated.id);
    expect(result.name).toBe('Growth Stocks');
  });

  it('updates target_pct for a group', async () => {
    const updated = makeGroup({ target_pct: 55 });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateGroup(updated.id, { target_pct: 55 });
    expect(result.target_pct).toBe(55);
  });

  it('updates type_id for a group', async () => {
    const newTypeId = '55555555-5555-5555-5555-555555555555';
    const updated = makeGroup({ type_id: newTypeId });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateGroup(updated.id, { type_id: newTypeId });
    expect(result.type_id).toBe(newTypeId);
  });

  it('updates scoring_method for a group', async () => {
    const updated = makeGroup({ scoring_method: 'graham' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateGroup(updated.id, { scoring_method: 'graham' });
    expect(result.scoring_method).toBe('graham');
  });

  it('validation: rejects empty update object', async () => {
    await expect(updateGroup('any-id', {})).rejects.toThrow(
      'At least one field must be provided for update',
    );
  });

  it('validation: rejects empty name in update', async () => {
    await expect(updateGroup('any-id', { name: '' })).rejects.toThrow(
      'Group name cannot be empty',
    );
  });

  it('validation: rejects whitespace-only name in update', async () => {
    await expect(updateGroup('any-id', { name: '   ' })).rejects.toThrow(
      'Group name cannot be empty',
    );
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'not found', code: 'PGRST116' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(updateGroup('bad-id', { name: 'Test' })).rejects.toEqual(err);
  });
});

// ---------- deleteGroup ----------

describe('deleteGroup', () => {
  it('T6.2.6 — deletes a group by ID', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteGroup('some-id')).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_groups');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'some-id');
  });

  it('throws on Supabase error (e.g. FK constraint from assets)', async () => {
    const err = { message: 'foreign key constraint', code: '23503' };

    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteGroup('used-id')).rejects.toEqual(err);
  });
});
