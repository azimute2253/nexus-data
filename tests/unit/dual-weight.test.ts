import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildL3Input } from '../../src/lib/nexus/data.js';
import { normalizeScores } from '../../src/lib/nexus/rebalance.js';
import type { Asset, AssetScore } from '../../src/lib/nexus/types.js';

// ── Helpers ─────────────────────────────────────────────────

const BASE_ASSET: Asset = {
  id: 'asset-1',
  ticker: 'PETR4',
  name: 'Petrobras',
  sector: 'Oil & Gas',
  quantity: 10,
  group_id: 'group-1',
  price_source: 'brapi',
  is_active: true,
  manual_override: false,
  whole_shares: true,
  bought: false,
  sold: false,
  weight_mode: 'questionnaire',
  manual_weight: 0,
  user_id: 'user-1',
  wallet_id: 'wallet-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return { ...BASE_ASSET, ...overrides };
}

function makeScore(total: number): AssetScore {
  return {
    id: 'score-1',
    asset_id: 'asset-1',
    questionnaire_id: 'q-1',
    answers: [],
    total_score: total,
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ── T14.1.1: Migration adds weight_mode + manual_weight columns ─

const migrationPath = resolve('supabase/migrations/019_add_weight_mode.sql');
const sql = readFileSync(migrationPath, 'utf-8');

describe('T14.1.1 — Migration adds weight_mode + manual_weight columns', () => {
  it('adds weight_mode column with NOT NULL DEFAULT questionnaire', () => {
    expect(sql).toMatch(/weight_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'questionnaire'/i);
  });

  it('has CHECK constraint for weight_mode values', () => {
    expect(sql).toContain("weight_mode IN ('manual', 'questionnaire')");
  });

  it('adds manual_weight column with DEFAULT 0', () => {
    expect(sql).toMatch(/manual_weight\s+NUMERIC\s+DEFAULT\s+0/i);
  });

  it('has CHECK constraint for manual_weight range (-10 to 11)', () => {
    expect(sql).toContain('manual_weight >= -10');
    expect(sql).toContain('manual_weight <= 11');
  });

  it('uses ALTER TABLE assets (not CREATE)', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+assets/i);
  });
});

// ── T14.1.2: Existing assets default to weight_mode = 'questionnaire' ─

describe('T14.1.2 — Existing assets default to questionnaire mode', () => {
  it('default weight_mode is questionnaire in the interface', () => {
    const asset = makeAsset();
    expect(asset.weight_mode).toBe('questionnaire');
  });

  it('default manual_weight is 0 in the interface', () => {
    const asset = makeAsset();
    expect(asset.manual_weight).toBe(0);
  });

  it('migration DEFAULT clause ensures backward compatibility', () => {
    expect(sql).toContain("DEFAULT 'questionnaire'");
    expect(sql).toContain('DEFAULT 0');
  });
});

// ── T14.1.3: buildL3Input with manual mode, weight=8 → score = 8 ─

describe('T14.1.3 — buildL3Input manual mode returns manual_weight', () => {
  it('returns manual_weight as score when weight_mode = manual', () => {
    const asset = makeAsset({ weight_mode: 'manual', manual_weight: 8 });
    const result = buildL3Input(asset, null, 38.50);
    expect(result.score).toBe(8);
  });

  it('ignores assetScore when weight_mode = manual', () => {
    const asset = makeAsset({ weight_mode: 'manual', manual_weight: 8 });
    const score = makeScore(99);
    const result = buildL3Input(asset, score, 38.50);
    expect(result.score).toBe(8);
  });
});

// ── T14.1.4: buildL3Input with questionnaire mode, total_score=6 → score = 6 ─

describe('T14.1.4 — buildL3Input questionnaire mode returns total_score', () => {
  it('returns total_score as score when weight_mode = questionnaire', () => {
    const asset = makeAsset({ weight_mode: 'questionnaire' });
    const score = makeScore(6);
    const result = buildL3Input(asset, score, 38.50);
    expect(result.score).toBe(6);
  });

  it('returns 0 when weight_mode = questionnaire and no score exists', () => {
    const asset = makeAsset({ weight_mode: 'questionnaire' });
    const result = buildL3Input(asset, null, 38.50);
    expect(result.score).toBe(0);
  });
});

// ── T14.1.5: SET manual_weight = 15 → constraint violation (> 11) ─

describe('T14.1.5 — Upper bound constraint (manual_weight <= 11)', () => {
  it('migration CHECK rejects values > 11', () => {
    // Verifying the SQL constraint exists (actual DB enforcement is integration-level)
    expect(sql).toContain('manual_weight <= 11');
  });
});

// ── T14.1.6: SET manual_weight = -11 → constraint violation (< -10) ─

describe('T14.1.6 — Lower bound constraint (manual_weight >= -10)', () => {
  it('migration CHECK rejects values < -10', () => {
    expect(sql).toContain('manual_weight >= -10');
  });
});

// ── T14.1.7: Mixed group [manual:8, questionnaire:6, manual:-2] ─

describe('T14.1.7 — Mixed group normalizeScores works correctly', () => {
  it('produces valid percentages for mixed [8, 6, -2] scores', () => {
    // Simulating: manual:8, questionnaire:6, manual:-2
    // These are the scores that buildL3Input would resolve
    const scores = [8, 6, -2];
    const result = normalizeScores(scores);

    // Shift: min=-2, shifted=[10, 8, 0], sum=18
    // Pcts: [10/18*100, 8/18*100, 0/18*100] = [55.56, 44.44, 0]
    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(55.56, 1);
    expect(result[1]).toBeCloseTo(44.44, 1);
    expect(result[2]).toBeCloseTo(0, 1);
  });

  it('percentages sum to 100', () => {
    const scores = [8, 6, -2];
    const result = normalizeScores(scores);
    const sum = result.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(100, 1);
  });

  it('buildL3Input correctly resolves mixed modes before normalization', () => {
    const assets = [
      makeAsset({ id: 'a1', weight_mode: 'manual', manual_weight: 8 }),
      makeAsset({ id: 'a2', weight_mode: 'questionnaire' }),
      makeAsset({ id: 'a3', weight_mode: 'manual', manual_weight: -2 }),
    ];
    const scores = [null, makeScore(6), null] as (AssetScore | null)[];

    const l3Inputs = assets.map((a, i) => buildL3Input(a, scores[i], 10));

    expect(l3Inputs[0].score).toBe(8);
    expect(l3Inputs[1].score).toBe(6);
    expect(l3Inputs[2].score).toBe(-2);

    // Feed resolved scores into normalizeScores
    const normalized = normalizeScores(l3Inputs.map((i) => i.score));
    expect(normalized[0]).toBeCloseTo(55.56, 1);
    expect(normalized[1]).toBeCloseTo(44.44, 1);
    expect(normalized[2]).toBeCloseTo(0, 1);
  });
});

// ── T14.1.8: distributeL3 source code unchanged (diff = 0) ─

describe('T14.1.8 — distributeL3 source code unchanged (L3 remains pure)', () => {
  const rebalancePath = resolve('src/lib/nexus/rebalance.ts');
  const rebalanceSrc = readFileSync(rebalancePath, 'utf-8');

  it('rebalance.ts SHA256 matches pre-story hash', () => {
    // Hash captured before Story 14.1 implementation
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256').update(rebalanceSrc).digest('hex');
    expect(hash).toBe('81b96d9e321d88cbd3ee132b3d201fa4817a8d48641573e1d934dc07ec2f90ea');
  });

  it('distributeL3 function signature is present and unchanged', () => {
    expect(rebalanceSrc).toContain('export function distributeL3(');
  });

  it('normalizeScores function signature is present and unchanged', () => {
    expect(rebalanceSrc).toContain('export function normalizeScores(');
  });
});

// ── Additional: buildL3Input maps all L3AssetInput fields correctly ─

describe('buildL3Input — field mapping', () => {
  it('maps all L3AssetInput fields from Asset', () => {
    const asset = makeAsset({
      id: 'x1',
      ticker: 'VALE3',
      group_id: 'g2',
      is_active: false,
      manual_override: true,
      whole_shares: false,
      weight_mode: 'manual',
      manual_weight: 5,
    });

    const result = buildL3Input(asset, null, 62.00);

    expect(result.asset_id).toBe('x1');
    expect(result.ticker).toBe('VALE3');
    expect(result.group_id).toBe('g2');
    expect(result.score).toBe(5);
    expect(result.price_brl).toBe(62.00);
    expect(result.is_active).toBe(false);
    expect(result.manual_override).toBe(true);
    expect(result.whole_shares).toBe(false);
  });

  it('handles negative manual_weight correctly', () => {
    const asset = makeAsset({ weight_mode: 'manual', manual_weight: -10 });
    const result = buildL3Input(asset, null, 10);
    expect(result.score).toBe(-10);
  });

  it('handles boundary manual_weight of 11', () => {
    const asset = makeAsset({ weight_mode: 'manual', manual_weight: 11 });
    const result = buildL3Input(asset, null, 10);
    expect(result.score).toBe(11);
  });
});
