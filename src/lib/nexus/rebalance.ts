// ============================================================
// Nexus Data — Rebalancing Algorithm
// Pure, deterministic, isomorphic. No side effects.
// ADR-004: 3-level cascade (L1 Type → L2 Group → L3 Asset)
// ============================================================

import type { L1TypeInput, L1Result } from './types.js';

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
