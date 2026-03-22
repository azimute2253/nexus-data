// ============================================================
// Nexus Data — Rebalancing Algorithm
// Pure, deterministic, isomorphic. No side effects.
// ADR-004: 3-level cascade (L1 Type → L2 Group → L3 Asset)
// ============================================================

import type { L1TypeInput, L1Result, L2GroupInput, L2Result } from './types.js';

/**
 * L1 Distribution — Type-Level Rebalancing
 *
 * Distributes a contribution (aporte) across asset types based on
 * target % vs actual allocation. Overweight types receive R$0;
 * underweight types receive proportionally to their deficit.
 *
 * Graceful degradation: if ALL types are overweight, the entire
 * contribution goes to the least-overweight type.
 *
 * Pure function — no DB calls, no API calls, no Date.now().
 */
export function distributeL1(
  types: L1TypeInput[],
  contribution: number,
): L1Result[] {
  // Runtime guard: reject negative inputs
  if (contribution < 0) {
    throw new Error(`Contribution must not be negative: ${contribution}`);
  }
  for (const t of types) {
    if (t.actual_value_brl < 0) {
      throw new Error(
        `Asset "${t.name}" (${t.type_id}) has negative actual_value_brl: ${t.actual_value_brl}`,
      );
    }
  }

  if (types.length === 0 || contribution === 0) {
    return types.map((t) => ({
      type_id: t.type_id,
      name: t.name,
      target_pct: t.target_pct,
      desired_value: 0,
      actual_value: t.actual_value_brl,
      deviation: 0,
      deficit: 0,
      allocated: 0,
    }));
  }

  const totalPortfolio = types.reduce((sum, t) => sum + t.actual_value_brl, 0);
  const totalAfterContribution = totalPortfolio + contribution;

  // Calculate desired value based on portfolio total AFTER the contribution
  const results: L1Result[] = types.map((t) => {
    const desired_value = totalAfterContribution * t.target_pct;
    const actual_value = t.actual_value_brl;
    const deviation = actual_value - desired_value;
    const deficit = Math.max(0, desired_value - actual_value);

    return {
      type_id: t.type_id,
      name: t.name,
      target_pct: t.target_pct,
      desired_value,
      actual_value,
      deviation,
      deficit,
      allocated: 0,
    };
  });

  const totalDeficit = results.reduce((sum, r) => sum + r.deficit, 0);

  if (totalDeficit > 0) {
    // Normal case: distribute proportionally to deficit among underweight types
    for (const r of results) {
      r.allocated = (r.deficit / totalDeficit) * contribution;
    }
  } else {
    // Graceful degradation: ALL types overweight → full aporte to least-overweight
    let leastOverweight = results[0];
    for (let i = 1; i < results.length; i++) {
      if (results[i].deviation < leastOverweight.deviation) {
        leastOverweight = results[i];
      }
    }
    leastOverweight.allocated = contribution;
  }

  // Sort by abs(deviation) descending — highest priority rebalancing first
  results.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  return results;
}

// ============================================================
// L2 Distribution — Group-Level Rebalancing
//
// Cascades L1 per-type allocations into groups within each type.
// Each group receives: type_allocated * group.target_pct
//
// Validation: group target_pct values within a type must sum to 1.0.
// Pure function — no side effects.
// ============================================================

const L2_PCT_SUM_TOLERANCE = 0.001;

export function distributeL2(
  l1Results: L1Result[],
  groups: L2GroupInput[],
): L2Result[] {
  // Index groups by type_id
  const groupsByType = new Map<string, L2GroupInput[]>();
  for (const g of groups) {
    const list = groupsByType.get(g.type_id);
    if (list) {
      list.push(g);
    } else {
      groupsByType.set(g.type_id, [g]);
    }
  }

  // Validate: group targets within each type must sum to ~1.0
  for (const [typeId, typeGroups] of groupsByType) {
    const sum = typeGroups.reduce((s, g) => s + g.target_pct, 0);
    if (Math.abs(sum - 1.0) > L2_PCT_SUM_TOLERANCE) {
      throw new Error(
        `Group targets for type "${typeId}" sum to ${sum.toFixed(4)}, expected 1.0`,
      );
    }
  }

  const results: L2Result[] = [];

  for (const l1 of l1Results) {
    const typeGroups = groupsByType.get(l1.type_id) ?? [];

    for (const g of typeGroups) {
      results.push({
        group_id: g.group_id,
        name: g.name,
        type_id: g.type_id,
        target_pct: g.target_pct,
        allocated: l1.allocated * g.target_pct,
      });
    }
  }

  return results;
}

/**
 * Score Normalization — Converts raw scores to proportional percentages.
 *
 * Handles negative scores by shifting the minimum to zero before computing
 * proportions. Used by L3 distribution to determine asset weights within
 * a group based on questionnaire results.
 *
 * Edge cases:
 * - Empty array → returns []
 * - Single score → returns [100]
 * - All scores equal (or all zero after shift) → equal distribution (1/N * 100)
 *
 * Pure function — no side effects.
 * [ADR-004 Obligation 4]
 */
export function normalizeScores(rawScores: number[]): number[] {
  if (rawScores.length === 0) return [];
  if (rawScores.length === 1) return [100];

  const min = Math.min(...rawScores);
  const shifted = min < 0 ? rawScores.map((s) => s - min) : [...rawScores];

  const sum = shifted.reduce((acc, v) => acc + v, 0);

  if (sum === 0) {
    const equal = 100 / shifted.length;
    return shifted.map(() => equal);
  }

  return shifted.map((v) => (v / sum) * 100);
}
