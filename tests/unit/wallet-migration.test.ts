import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  AssetType,
  AssetGroup,
  Asset,
  Questionnaire,
  AssetScore,
  Contribution,
  PriceCache,
  ExchangeRate,
  PriceRefreshLog,
} from '../../src/lib/nexus/types.js';

// ── Load migration SQL files ────────────────────────────────

const step1Path = resolve('supabase/migrations/016_add_wallet_id_nullable.sql');
const step2Path = resolve('supabase/migrations/017_backfill_wallet_id.sql');
const step3Path = resolve('supabase/migrations/018_wallet_id_not_null.sql');

const step1Sql = readFileSync(step1Path, 'utf-8');
const step2Sql = readFileSync(step2Path, 'utf-8');
const step3Sql = readFileSync(step3Path, 'utf-8');

// ── Affected tables ─────────────────────────────────────────

const AFFECTED_TABLES = [
  'asset_types',
  'asset_groups',
  'assets',
  'questionnaires',
  'asset_scores',
  'contributions',
] as const;

const PRICE_TABLES = [
  'price_cache',
  'exchange_rates',
  'price_refresh_log',
] as const;

// ── T11.2.1: Step 1 — wallet_id column exists (nullable) ───

describe('T11.2.1 — Step 1: Add nullable wallet_id FK + indexes', () => {
  for (const table of AFFECTED_TABLES) {
    it(`adds wallet_id column to ${table}`, () => {
      const pattern = new RegExp(
        `ALTER\\s+TABLE\\s+${table}\\s*\\n\\s*ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+wallet_id\\s+UUID\\s+REFERENCES\\s+wallets\\(id\\)\\s+ON\\s+DELETE\\s+CASCADE`,
        'i',
      );
      expect(step1Sql).toMatch(pattern);
    });
  }

  it('wallet_id is nullable (no NOT NULL in step 1)', () => {
    // Step 1 should NOT contain NOT NULL for wallet_id
    expect(step1Sql).not.toMatch(/wallet_id\s+UUID\s+NOT\s+NULL/i);
  });

  for (const table of AFFECTED_TABLES) {
    it(`creates composite index on (user_id, wallet_id) for ${table}`, () => {
      expect(step1Sql).toMatch(
        new RegExp(`CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+idx_${table}_user_wallet\\s+ON\\s+${table}\\(user_id,\\s*wallet_id\\)`, 'i'),
      );
    });
  }
});

// ── T11.2.2: Step 2 — default wallets created, wallet_id populated

describe('T11.2.2 — Step 2: Backfill wallet_id', () => {
  it('creates default wallet "Minha Carteira" per user_id', () => {
    expect(step2Sql).toContain("'Minha Carteira'");
    expect(step2Sql).toMatch(/INSERT\s+INTO\s+wallets/i);
  });

  for (const table of AFFECTED_TABLES) {
    it(`backfills wallet_id on ${table}`, () => {
      const pattern = new RegExp(
        `UPDATE\\s+${table}\\s*\\nSET\\s+wallet_id\\s*=\\s*w\\.id`,
        'i',
      );
      expect(step2Sql).toMatch(pattern);
    });
  }

  it('only backfills rows where wallet_id IS NULL', () => {
    const nullChecks = step2Sql.match(/wallet_id\s+IS\s+NULL/gi) || [];
    expect(nullChecks.length).toBe(AFFECTED_TABLES.length);
  });

  it('uses ON CONFLICT DO NOTHING for idempotent wallet creation', () => {
    expect(step2Sql).toMatch(/ON\s+CONFLICT\s+DO\s+NOTHING/i);
  });
});

// ── T11.2.3: Step 3 — NOT NULL constraint active ───────────

describe('T11.2.3 — Step 3: wallet_id NOT NULL + UNIQUE updates', () => {
  for (const table of AFFECTED_TABLES) {
    it(`makes wallet_id NOT NULL on ${table}`, () => {
      const pattern = new RegExp(
        `ALTER\\s+TABLE\\s+${table}\\s+ALTER\\s+COLUMN\\s+wallet_id\\s+SET\\s+NOT\\s+NULL`,
        'i',
      );
      expect(step3Sql).toMatch(pattern);
    });
  }

  it('updates UNIQUE constraint on asset_types to include wallet_id', () => {
    expect(step3Sql).toMatch(/asset_types_user_wallet_name_unique/i);
    expect(step3Sql).toMatch(/UNIQUE\s*\(user_id,\s*wallet_id,\s*name\)/i);
  });

  it('updates UNIQUE constraint on asset_groups to include wallet_id', () => {
    expect(step3Sql).toMatch(/asset_groups_type_wallet_name_unique/i);
    expect(step3Sql).toMatch(/UNIQUE\s*\(type_id,\s*wallet_id,\s*name,\s*user_id\)/i);
  });

  it('updates UNIQUE constraint on assets to include wallet_id', () => {
    expect(step3Sql).toMatch(/assets_ticker_user_wallet_unique/i);
    expect(step3Sql).toMatch(/UNIQUE\s*\(ticker,\s*user_id,\s*wallet_id\)/i);
  });

  it('updates UNIQUE constraint on asset_scores to include wallet_id', () => {
    expect(step3Sql).toMatch(/asset_scores_asset_questionnaire_wallet_unique/i);
    expect(step3Sql).toMatch(/UNIQUE\s*\(asset_id,\s*questionnaire_id,\s*wallet_id\)/i);
  });

  it('drops old UNIQUE constraints before creating new ones', () => {
    expect(step3Sql).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+asset_groups_name_type_user_unique/i);
    expect(step3Sql).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+assets_ticker_user_unique/i);
    expect(step3Sql).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+asset_scores_asset_id_questionnaire_id_key/i);
  });
});

// ── T11.2.4: price_cache has NO wallet_id column ────────────

describe('T11.2.4 — Price tables do NOT get wallet_id', () => {
  for (const table of PRICE_TABLES) {
    it(`${table} is NOT mentioned in step 1 (no wallet_id added)`, () => {
      // None of the 3 migration files should ALTER these tables
      const tablePattern = new RegExp(`ALTER\\s+TABLE\\s+${table}`, 'i');
      expect(step1Sql).not.toMatch(tablePattern);
      expect(step2Sql).not.toMatch(tablePattern);
      expect(step3Sql).not.toMatch(tablePattern);
    });
  }
});

// ── T11.2.5: ON DELETE CASCADE on all FKs ───────────────────

describe('T11.2.5 — ON DELETE CASCADE for wallet_id FKs', () => {
  it('all 6 wallet_id FKs use ON DELETE CASCADE', () => {
    const cascadeMatches = step1Sql.match(/ON\s+DELETE\s+CASCADE/gi) || [];
    expect(cascadeMatches.length).toBe(AFFECTED_TABLES.length);
  });
});

// ── T11.2.6: Data preservation (row count logic) ────────────

describe('T11.2.6 — Data preservation verified by migration design', () => {
  it('step 1 uses ADD COLUMN IF NOT EXISTS (no data loss)', () => {
    for (const table of AFFECTED_TABLES) {
      expect(step1Sql).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+${table}\\s*\\n\\s*ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS`, 'i'),
      );
    }
  });

  it('step 2 uses UPDATE (not DELETE/INSERT) for backfill', () => {
    expect(step2Sql).not.toMatch(/DELETE\s+FROM\s+(asset_types|asset_groups|assets|questionnaires|asset_scores|contributions)/i);
    for (const table of AFFECTED_TABLES) {
      expect(step2Sql).toMatch(new RegExp(`UPDATE\\s+${table}`, 'i'));
    }
  });

  it('step 3 uses ALTER COLUMN (not DROP/RECREATE)', () => {
    expect(step3Sql).not.toMatch(/DROP\s+TABLE/i);
    expect(step3Sql).not.toMatch(/DROP\s+COLUMN/i);
  });
});

// ── TypeScript types: wallet_id present on affected interfaces ─

describe('TypeScript types — wallet_id field on affected interfaces', () => {
  it('AssetType has wallet_id', () => {
    const obj: AssetType = {
      id: 'id', name: 'n', target_pct: null, sort_order: null,
      user_id: 'u', wallet_id: 'w', created_at: '', updated_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('AssetGroup has wallet_id', () => {
    const obj: AssetGroup = {
      id: 'id', type_id: 't', name: null, target_pct: null,
      scoring_method: 'questionnaire', user_id: 'u', wallet_id: 'w',
      created_at: '', updated_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('Asset has wallet_id', () => {
    const obj: Asset = {
      id: 'id', ticker: 'T', name: null, sector: null, quantity: 0,
      group_id: 'g', price_source: 'brapi', is_active: true,
      manual_override: false, whole_shares: true, bought: false, sold: false,
      user_id: 'u', wallet_id: 'w', created_at: '', updated_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('Questionnaire has wallet_id', () => {
    const obj: Questionnaire = {
      id: 'id', name: null, asset_type_id: null, questions: [],
      user_id: 'u', wallet_id: 'w', created_at: '', updated_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('AssetScore has wallet_id', () => {
    const obj: AssetScore = {
      id: 'id', asset_id: 'a', questionnaire_id: 'q', answers: [],
      total_score: 0, user_id: 'u', wallet_id: 'w',
      created_at: '', updated_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('Contribution has wallet_id', () => {
    const obj: Contribution = {
      id: 'id', contributed_at: null, amount: null, distribution: null,
      user_id: 'u', wallet_id: 'w', created_at: '',
    };
    expect(obj.wallet_id).toBe('w');
  });

  it('PriceCache does NOT have wallet_id', () => {
    const obj: PriceCache = {
      ticker: 'T', price: null, currency: 'BRL', source: null,
      fetched_at: '', user_id: 'u',
    };
    // @ts-expect-error — wallet_id should not exist on PriceCache
    expect(obj.wallet_id).toBeUndefined();
  });

  it('ExchangeRate does NOT have wallet_id', () => {
    const obj: ExchangeRate = {
      pair: 'USD/BRL', rate: null, fetched_at: '', user_id: 'u',
    };
    // @ts-expect-error — wallet_id should not exist on ExchangeRate
    expect(obj.wallet_id).toBeUndefined();
  });

  it('PriceRefreshLog does NOT have wallet_id', () => {
    const obj: PriceRefreshLog = {
      id: 'id', refreshed_at: '', trigger: 'manual', user_id: null,
    };
    // @ts-expect-error — wallet_id should not exist on PriceRefreshLog
    expect(obj.wallet_id).toBeUndefined();
  });
});
