import { describe, it, expect } from 'vitest';
import { TABS } from '../../src/components/nexus/TabNavigation.js';
import type { TabId, TabDef } from '../../src/components/nexus/TabNavigation.js';

// ── Tests: Tab configuration (AC1, T13.1.1) ────────────────

describe('TABS configuration', () => {
  it('T13.1.1 — defines exactly 3 tabs', () => {
    expect(TABS).toHaveLength(3);
  });

  it('T13.1.1 — contains Dashboard, Aportes, Ativos tabs', () => {
    const labels = TABS.map((t) => t.label);
    expect(labels).toEqual(['Dashboard', 'Aportes', 'Ativos']);
  });

  it('has unique tab IDs', () => {
    const ids = TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each tab has an icon', () => {
    for (const tab of TABS) {
      expect(tab.icon).toBeTruthy();
    }
  });

  it('tab IDs match expected values', () => {
    const ids = TABS.map((t) => t.id);
    expect(ids).toEqual(['dashboard', 'aportes', 'ativos']);
  });
});

// ── Tests: TabId type correctness ───────────────────────────

describe('TabId type', () => {
  it('TABS ids are valid TabId values', () => {
    const validIds: TabId[] = ['dashboard', 'aportes', 'ativos'];
    for (const tab of TABS) {
      expect(validIds).toContain(tab.id);
    }
  });
});

// ── Tests: TabDef shape ─────────────────────────────────────

describe('TabDef structure', () => {
  it('each tab has required properties', () => {
    for (const tab of TABS) {
      expect(tab).toHaveProperty('id');
      expect(tab).toHaveProperty('label');
      expect(tab).toHaveProperty('icon');
      expect(typeof tab.id).toBe('string');
      expect(typeof tab.label).toBe('string');
    }
  });
});
