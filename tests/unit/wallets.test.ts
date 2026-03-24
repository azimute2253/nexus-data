import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Wallet, WalletInsert } from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────

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
  getWallets,
  getWallet,
  createWallet,
  updateWallet,
  deleteWallet,
  isWalletOwner,
} from '../../src/lib/nexus/wallets.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ID_A = '00000000-0000-0000-0000-000000000099';
const WALLET_ID_B = '00000000-0000-0000-0000-000000000100';

function makeWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: WALLET_ID_A,
    user_id: USER_ID,
    name: 'Carteira Principal',
    created_at: '2026-01-01T00:00:00Z',
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

// ---------- T11.3.1: createWallet ----------

describe('createWallet', () => {
  it('T11.3.1 — creates wallet with name and returns id + name', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: 'Test' };
    const created = makeWallet({ name: 'Test' });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createWallet(input);

    expect(queryBuilder.from).toHaveBeenCalledWith('wallets');
    expect(queryBuilder.insert).toHaveBeenCalledWith(input);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test');
  });

  it('T11.3.5 — rejects empty name', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: '' };

    await expect(createWallet(input)).rejects.toThrow('Wallet name is required');
  });

  it('rejects whitespace-only name', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: '   ' };

    await expect(createWallet(input)).rejects.toThrow('Wallet name is required');
  });

  it('rejects name longer than 50 characters', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: 'A'.repeat(51) };

    await expect(createWallet(input)).rejects.toThrow('Wallet name must be 50 characters or less');
  });

  it('accepts name exactly 50 characters', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: 'A'.repeat(50) };
    const created = makeWallet({ name: 'A'.repeat(50) });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createWallet(input);
    expect(result.name).toBe('A'.repeat(50));
  });

  it('throws on Supabase error', async () => {
    const input: WalletInsert = { user_id: USER_ID, name: 'Test' };
    const err = { message: 'constraint violation', code: '23505' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createWallet(input)).rejects.toEqual(err);
  });
});

// ---------- T11.3.2: getWallets ----------

describe('getWallets', () => {
  it('T11.3.2 — returns 2 wallets for user with 2 wallets', async () => {
    const wallets = [
      makeWallet({ id: WALLET_ID_A, name: 'Carteira A' }),
      makeWallet({ id: WALLET_ID_B, name: 'Carteira B' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: wallets, error: null });

    const result = await getWallets(USER_ID);

    expect(queryBuilder.from).toHaveBeenCalledWith('wallets');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no wallets exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getWallets(USER_ID);
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getWallets(USER_ID)).rejects.toEqual(err);
  });
});

// ---------- getWallet (single by ID) ----------

describe('getWallet', () => {
  it('returns a single wallet by ID', async () => {
    const wallet = makeWallet();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: wallet, error: null });

    const result = await getWallet(WALLET_ID_A);

    expect(queryBuilder.from).toHaveBeenCalledWith('wallets');
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', WALLET_ID_A);
    expect(result).toEqual(wallet);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getWallet('nonexistent-id');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getWallet('any-id')).rejects.toEqual(err);
  });
});

// ---------- T11.3.6: updateWallet ----------

describe('updateWallet', () => {
  it('T11.3.6 — updates wallet name', async () => {
    const updated = makeWallet({ name: 'New Name' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateWallet(WALLET_ID_A, { name: 'New Name' });

    expect(queryBuilder.from).toHaveBeenCalledWith('wallets');
    expect(queryBuilder.update).toHaveBeenCalledWith({ name: 'New Name' });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', WALLET_ID_A);
    expect(result.name).toBe('New Name');
  });

  it('rejects empty update object', async () => {
    await expect(updateWallet(WALLET_ID_A, {})).rejects.toThrow(
      'At least one field must be provided for update',
    );
  });

  it('rejects empty name in update', async () => {
    await expect(updateWallet(WALLET_ID_A, { name: '' })).rejects.toThrow(
      'Wallet name is required',
    );
  });

  it('rejects name over 50 chars in update', async () => {
    await expect(
      updateWallet(WALLET_ID_A, { name: 'A'.repeat(51) }),
    ).rejects.toThrow('Wallet name must be 50 characters or less');
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'not found', code: 'PGRST116' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(updateWallet('bad-id', { name: 'Test' })).rejects.toEqual(err);
  });
});

// ---------- T11.3.3: deleteWallet (cascade) ----------

describe('deleteWallet', () => {
  it('T11.3.3 — deletes a wallet by ID (cascade via DB FK)', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteWallet(WALLET_ID_A)).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('wallets');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', WALLET_ID_A);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };

    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteWallet('bad-id')).rejects.toEqual(err);
  });
});

// ---------- isWalletOwner ----------

describe('isWalletOwner', () => {
  it('returns true when wallet exists (RLS ensures ownership)', async () => {
    const wallet = makeWallet();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: wallet, error: null });

    const result = await isWalletOwner(WALLET_ID_A);
    expect(result).toBe(true);
  });

  it('returns false when wallet not found (not owned)', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await isWalletOwner('not-my-wallet');
    expect(result).toBe(false);
  });
});

// ---------- T11.3.4: Cross-wallet isolation ----------

describe('wallet isolation', () => {
  it('T11.3.4 — getAssetTypes filters by wallet_id', async () => {
    // Import getAssetTypes to verify it accepts walletId
    const { getAssetTypes } = await import('../../src/lib/nexus/asset-types.js');

    const walletATypes = [
      { id: 'type-1', name: 'FIIs', wallet_id: WALLET_ID_A },
      { id: 'type-2', name: 'Ações', wallet_id: WALLET_ID_A },
      { id: 'type-3', name: 'Crypto', wallet_id: WALLET_ID_A },
    ];

    queryBuilder.order.mockReturnValueOnce({ data: walletATypes, error: null });

    const resultA = await getAssetTypes(WALLET_ID_A);

    expect(queryBuilder.eq).toHaveBeenCalledWith('wallet_id', WALLET_ID_A);
    expect(resultA).toHaveLength(3);

    // Reset for wallet B
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

    const walletBTypes = [
      { id: 'type-4', name: 'ETFs', wallet_id: WALLET_ID_B },
      { id: 'type-5', name: 'Bonds', wallet_id: WALLET_ID_B },
    ];

    queryBuilder.order.mockReturnValueOnce({ data: walletBTypes, error: null });

    const resultB = await getAssetTypes(WALLET_ID_B);

    expect(queryBuilder.eq).toHaveBeenCalledWith('wallet_id', WALLET_ID_B);
    expect(resultB).toHaveLength(2);

    // Verify isolation: different wallets return different results
    expect(resultA).not.toEqual(resultB);
  });
});
