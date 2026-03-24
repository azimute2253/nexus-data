import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Wallet, WalletInsert, WalletUpdate } from '../../src/lib/nexus/types.js';

// ── Load migration SQL ──────────────────────────────────────
const migrationPath = resolve('supabase/migrations/015_create_wallets.sql');
const sql = readFileSync(migrationPath, 'utf-8');

// ── T11.1.1: Migration creates wallets table ────────────────

describe('T11.1.1 — wallets table migration', () => {
  it('uses CREATE TABLE IF NOT EXISTS for idempotency', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS wallets');
  });

  it('has id UUID PRIMARY KEY with gen_random_uuid()', () => {
    expect(sql).toMatch(/id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  });

  it('has user_id UUID NOT NULL referencing auth.users(id)', () => {
    expect(sql).toMatch(/user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)/i);
  });

  it('has name TEXT NOT NULL', () => {
    expect(sql).toMatch(/name\s+TEXT\s+NOT\s+NULL/i);
  });

  it('has created_at TIMESTAMPTZ NOT NULL DEFAULT now()', () => {
    expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i);
  });
});

// ── T11.1.2: RLS policies block cross-user access ──────────

describe('T11.1.2 — RLS policies', () => {
  it('enables RLS on wallets table', () => {
    expect(sql).toContain('ALTER TABLE wallets ENABLE ROW LEVEL SECURITY');
  });

  it('has SELECT policy with auth.uid() = user_id', () => {
    expect(sql).toContain('wallets_select_own');
    expect(sql).toMatch(/FOR\s+SELECT\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  });

  it('has INSERT policy with auth.uid() = user_id', () => {
    expect(sql).toContain('wallets_insert_own');
    expect(sql).toMatch(/FOR\s+INSERT\s+WITH\s+CHECK\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  });

  it('has UPDATE policy with auth.uid() = user_id', () => {
    expect(sql).toContain('wallets_update_own');
    expect(sql).toMatch(/FOR\s+UPDATE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  });

  it('has DELETE policy with auth.uid() = user_id', () => {
    expect(sql).toContain('wallets_delete_own');
    expect(sql).toMatch(/FOR\s+DELETE\s+USING\s+\(auth\.uid\(\)\s*=\s*user_id\)/i);
  });

  it('uses DROP POLICY IF EXISTS for idempotency', () => {
    const drops = sql.match(/DROP POLICY IF EXISTS/g) || [];
    expect(drops.length).toBe(4); // SELECT, INSERT, UPDATE, DELETE
  });
});

// ── T11.1.3 + T11.1.4: Name validation constraint ──────────

describe('T11.1.3/T11.1.4 — name validation constraint', () => {
  it('has CHECK constraint for minimum trimmed length >= 1', () => {
    expect(sql).toMatch(/length\(trim\(name\)\)\s*>=\s*1/i);
  });

  it('has CHECK constraint for maximum length <= 50', () => {
    expect(sql).toMatch(/length\(name\)\s*<=\s*50/i);
  });

  it('names the constraint wallets_name_length', () => {
    expect(sql).toContain('wallets_name_length');
  });
});

// ── T11.1.5: Idempotent migration ──────────────────────────

describe('T11.1.5 — idempotent migration', () => {
  it('uses IF NOT EXISTS on CREATE TABLE', () => {
    expect(sql).toContain('IF NOT EXISTS');
  });

  it('uses DROP POLICY IF EXISTS before each CREATE POLICY', () => {
    const creates = sql.match(/CREATE POLICY/g) || [];
    const drops = sql.match(/DROP POLICY IF EXISTS/g) || [];
    expect(drops.length).toBe(creates.length);
  });
});

// ── TypeScript types validation ─────────────────────────────

describe('TypeScript types — Wallet interfaces', () => {
  it('Wallet has all required fields', () => {
    const wallet: Wallet = {
      id: 'uuid-1',
      user_id: 'uuid-2',
      name: 'My Portfolio',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(wallet.id).toBeDefined();
    expect(wallet.user_id).toBeDefined();
    expect(wallet.name).toBeDefined();
    expect(wallet.created_at).toBeDefined();
  });

  it('WalletInsert omits id and created_at', () => {
    const insert: WalletInsert = {
      user_id: 'uuid-2',
      name: 'New Wallet',
    };
    expect(insert.user_id).toBeDefined();
    expect(insert.name).toBeDefined();
    // @ts-expect-error — id should not exist on WalletInsert
    expect(insert.id).toBeUndefined();
  });

  it('WalletUpdate has all fields optional', () => {
    const empty: WalletUpdate = {};
    expect(empty).toEqual({});

    const partial: WalletUpdate = { name: 'Renamed' };
    expect(partial.name).toBe('Renamed');
  });
});
