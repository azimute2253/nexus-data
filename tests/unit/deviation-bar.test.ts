import { describe, it, expect } from 'vitest';
import {
  getDeviationLevel,
  getBarWidthPct,
  MAX_DEVIATION_PP,
  ALIGNED_THRESHOLD_PP,
  SIGNIFICANT_THRESHOLD_PP,
} from '../../src/components/nexus/DeviationBar.js';

// ── Tests: getDeviationLevel ────────────────────────────────

describe('getDeviationLevel', () => {
  it('T5.4.3 — returns aligned for deviation within ±2pp', () => {
    expect(getDeviationLevel(0)).toBe('aligned');
    expect(getDeviationLevel(1.5)).toBe('aligned');
    expect(getDeviationLevel(-1.5)).toBe('aligned');
    expect(getDeviationLevel(2.0)).toBe('aligned');
    expect(getDeviationLevel(-2.0)).toBe('aligned');
  });

  it('returns minor-over for deviation >2pp and ≤10pp', () => {
    expect(getDeviationLevel(2.01)).toBe('minor-over');
    expect(getDeviationLevel(5)).toBe('minor-over');
    expect(getDeviationLevel(10)).toBe('minor-over');
  });

  it('returns minor-under for deviation <-2pp and ≥-10pp', () => {
    expect(getDeviationLevel(-2.01)).toBe('minor-under');
    expect(getDeviationLevel(-5)).toBe('minor-under');
    expect(getDeviationLevel(-10)).toBe('minor-under');
  });

  it('T5.4.1 — returns significant-over for deviation >10pp (red bar)', () => {
    expect(getDeviationLevel(10.01)).toBe('significant-over');
    expect(getDeviationLevel(50)).toBe('significant-over');
    expect(getDeviationLevel(17.73)).toBe('significant-over');
  });

  it('T5.4.2 — returns significant-under for deviation <-10pp (orange bar)', () => {
    expect(getDeviationLevel(-10.01)).toBe('significant-under');
    expect(getDeviationLevel(-17)).toBe('significant-under');
    expect(getDeviationLevel(-50)).toBe('significant-under');
  });
});

// ── Tests: getBarWidthPct ───────────────────────────────────

describe('getBarWidthPct', () => {
  it('T5.4.3 — returns 0 for aligned deviations (±2pp)', () => {
    expect(getBarWidthPct(0)).toBe(0);
    expect(getBarWidthPct(1.5)).toBe(0);
    expect(getBarWidthPct(-1.5)).toBe(0);
    expect(getBarWidthPct(2.0)).toBe(0);
    expect(getBarWidthPct(-2.0)).toBe(0);
  });

  it('scales linearly with deviation magnitude', () => {
    // 25pp / 50pp max = 50%
    expect(getBarWidthPct(25)).toBe(50);
    expect(getBarWidthPct(-25)).toBe(50);
  });

  it('T5.4.1 — large deviation (+50pp) maps to 100% width', () => {
    expect(getBarWidthPct(50)).toBe(100);
    expect(getBarWidthPct(-50)).toBe(100);
  });

  it('clamps to 100% for deviations exceeding MAX_DEVIATION_PP', () => {
    expect(getBarWidthPct(80)).toBe(100);
    expect(getBarWidthPct(-100)).toBe(100);
  });

  it('small deviation (5pp) produces proportional width', () => {
    // 5pp / 50pp = 10%
    expect(getBarWidthPct(5)).toBe(10);
  });

  it('+50pp bar is 10x the width of +5pp bar (linear scaling)', () => {
    const width5 = getBarWidthPct(5);
    const width50 = getBarWidthPct(50);
    expect(width50 / width5).toBe(10);
  });
});

// ── Tests: Constants sanity check ───────────────────────────

describe('DeviationBar constants', () => {
  it('has correct threshold values', () => {
    expect(MAX_DEVIATION_PP).toBe(50);
    expect(ALIGNED_THRESHOLD_PP).toBe(2);
    expect(SIGNIFICANT_THRESHOLD_PP).toBe(10);
  });
});

// ── Tests: T5.4.5 — null target_pct edge case ──────────────
// The targetMissing prop handling is tested at component level.
// Pure logic functions work with numeric deviation_pct only.
// When target_pct is null, the caller passes targetMissing=true
// and the component renders "—" without calling getDeviationLevel/getBarWidthPct.
