// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AtivosTab } from '../../src/components/nexus/AtivosTab.js';
import type { Asset, AssetType, AssetGroup, Questionnaire } from '../../src/lib/nexus/types.js';

// ── Mock Supabase CRUD ─────────────────────────────────────

const mockAssetTypes: AssetType[] = [];
const mockGroups: AssetGroup[] = [];
const mockAssets: Asset[] = [];
const mockQuestionnaires: Questionnaire[] = [];

vi.mock('../../src/lib/nexus/asset-types.js', () => ({
  getAssetTypes: vi.fn(() => Promise.resolve(mockAssetTypes)),
  createAssetType: vi.fn((input) =>
    Promise.resolve({ id: 'new-type', ...input, created_at: '', updated_at: '' }),
  ),
  updateAssetType: vi.fn((id, updates) => {
    const existing = mockAssetTypes.find((t) => t.id === id);
    return Promise.resolve({ ...existing, ...updates, id });
  }),
  deleteAssetType: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/nexus/groups.js', () => ({
  getGroups: vi.fn(() => Promise.resolve(mockGroups)),
  createGroup: vi.fn((input) =>
    Promise.resolve({ id: 'new-group', ...input, created_at: '', updated_at: '' }),
  ),
  updateGroup: vi.fn((id, updates) => {
    const existing = mockGroups.find((g) => g.id === id);
    return Promise.resolve({ ...existing, ...updates, id });
  }),
  deleteGroup: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/nexus/assets.js', () => ({
  getAssets: vi.fn(() => Promise.resolve(mockAssets)),
  createAsset: vi.fn((input) =>
    Promise.resolve({ id: 'new-asset', ...input, created_at: '', updated_at: '' }),
  ),
  updateAsset: vi.fn((id, updates) => {
    const existing = mockAssets.find((a) => a.id === id);
    return Promise.resolve({ ...existing, ...updates, id });
  }),
  deleteAsset: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../src/lib/nexus/questionnaires.js', () => ({
  getQuestionnaires: vi.fn(() => Promise.resolve(mockQuestionnaires)),
}));

vi.mock('../../src/lib/nexus/asset-scores.js', () => ({
  getAssetScore: vi.fn(() => Promise.resolve(null)),
  saveAssetScore: vi.fn(() => Promise.resolve({ id: 'score-1', total_score: 5 })),
}));

afterEach(() => {
  cleanup();
  // Reset arrays
  mockAssetTypes.length = 0;
  mockGroups.length = 0;
  mockAssets.length = 0;
  mockQuestionnaires.length = 0;
});

// ── Helpers ─────────────────────────────────────────────────

function makeAssetType(overrides: Partial<AssetType> = {}): AssetType {
  return {
    id: 'type-1',
    name: 'Ações BR',
    target_pct: 25,
    sort_order: 1,
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<AssetGroup> = {}): AssetGroup {
  return {
    id: 'group-1',
    type_id: 'type-1',
    name: 'Large Cap',
    target_pct: 60,
    scoring_method: 'manual',
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
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
    weight_mode: 'manual',
    manual_weight: 7,
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function seedData() {
  mockAssetTypes.push(
    makeAssetType({ id: 'type-1', name: 'Ações BR', target_pct: 25 }),
    makeAssetType({ id: 'type-2', name: 'FIIs', target_pct: 15 }),
  );
  mockGroups.push(
    makeGroup({ id: 'group-1', type_id: 'type-1', name: 'Large Cap', target_pct: 60 }),
    makeGroup({ id: 'group-2', type_id: 'type-1', name: 'Small Cap', target_pct: 40 }),
    makeGroup({ id: 'group-3', type_id: 'type-2', name: 'Tijolo', target_pct: 100 }),
  );
  mockAssets.push(
    makeAsset({ id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', group_id: 'group-1', manual_weight: 7, weight_mode: 'questionnaire' }),
    makeAsset({ id: 'asset-2', ticker: 'VALE3', name: 'Vale', group_id: 'group-1', manual_weight: 5, weight_mode: 'manual' }),
    makeAsset({ id: 'asset-3', ticker: 'WEGE3', name: 'WEG', group_id: 'group-2', manual_weight: 3, weight_mode: 'manual' }),
    makeAsset({ id: 'asset-4', ticker: 'XPML11', name: null, group_id: 'group-3', manual_weight: 4, weight_mode: 'manual' }),
    makeAsset({ id: 'asset-5', ticker: 'HGLG11', name: null, group_id: 'group-3', manual_weight: 6, weight_mode: 'manual' }),
  );
}

// ── T15.3.1: Hierarchical tree renders ─────────────────────

describe('T15.3.1 — Wallet with 2 classes, 3 groups, 5 assets renders hierarchical tree', () => {
  it('renders all classes, groups, and assets in a tree', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    // Classes
    expect(screen.getByText('Ações BR')).toBeInTheDocument();
    expect(screen.getByText('FIIs')).toBeInTheDocument();

    // Groups
    expect(screen.getByText('Large Cap')).toBeInTheDocument();
    expect(screen.getByText('Small Cap')).toBeInTheDocument();
    expect(screen.getByText('Tijolo')).toBeInTheDocument();

    // Assets
    expect(screen.getByText('PETR4')).toBeInTheDocument();
    expect(screen.getByText('VALE3')).toBeInTheDocument();
    expect(screen.getByText('WEGE3')).toBeInTheDocument();
    expect(screen.getByText('XPML11')).toBeInTheDocument();
    expect(screen.getByText('HGLG11')).toBeInTheDocument();

    // Visual indentation — asset tree structure
    expect(screen.getByTestId('asset-tree')).toBeInTheDocument();
    const classNodes = screen.getAllByTestId('class-node');
    expect(classNodes).toHaveLength(2);
  });
});

// ── T15.3.2: Click [+ Nova Classe] shows create form ───────

describe('T15.3.2 — Click [+ Nova Classe] shows create form', () => {
  it('shows create class form when button is clicked', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-class-btn');
    fireEvent.click(addBtn);

    expect(screen.getByTestId('create-class-form')).toBeInTheDocument();
  });
});

// ── T15.3.3: Click [editar] on asset opens DualWeightPanel ──

describe('T15.3.3 — Click [editar] on asset opens DualWeightPanel', () => {
  it('opens DualWeightPanel modal when [editar] clicked on asset', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByTestId('asset-edit-btn');
    fireEvent.click(editBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('weight-panel-modal')).toBeInTheDocument();
    });
  });
});

// ── T15.3.4: Asset shows weight with mode indicator ─────────

describe('T15.3.4 — Asset shows weight with mode indicator', () => {
  it('shows "peso: 7 (questionário)" format for questionnaire mode', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const weightDisplays = screen.getAllByTestId('asset-weight-display');
    // PETR4 is questionnaire mode
    expect(weightDisplays[0]).toHaveTextContent('peso: — (questionário)');
  });

  it('shows "peso: 5 (manual)" format for manual mode', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const weightDisplays = screen.getAllByTestId('asset-weight-display');
    // VALE3 is manual mode with weight 5
    expect(weightDisplays[1]).toHaveTextContent('peso: 5 (manual)');
  });
});

// ── T15.3.5: Class targets sum ≠ 100% shows warning ────────

describe('T15.3.5 — Class targets sum to 90% shows warning', () => {
  it('shows warning when class target percentages do not sum to 100%', async () => {
    // Classes sum to 25 + 15 = 40% (not 100%)
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const warnings = screen.getAllByTestId('target-warning');
    // At least one warning should mention "classes"
    const classWarning = warnings.find((w) => w.textContent?.includes('classes'));
    expect(classWarning).toBeTruthy();
    expect(classWarning!.textContent).toContain('40.0%');
  });
});

// ── T15.3.6: Group targets within class sum ≠ 100% (+1pp) ──

describe('T15.3.6 — Group targets within class sum to 105% shows warning', () => {
  it('shows warning when group target within class differs >1pp from 100%', async () => {
    mockAssetTypes.push(
      makeAssetType({ id: 'type-1', name: 'Ações BR', target_pct: 100 }),
    );
    mockGroups.push(
      makeGroup({ id: 'group-1', type_id: 'type-1', name: 'Large Cap', target_pct: 65 }),
      makeGroup({ id: 'group-2', type_id: 'type-1', name: 'Small Cap', target_pct: 40 }),
    );

    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    const warnings = screen.getAllByTestId('target-warning');
    const groupWarning = warnings.find((w) => w.textContent?.includes('grupos'));
    expect(groupWarning).toBeTruthy();
    expect(groupWarning!.textContent).toContain('105.0%');
  });

  it('does not show warning when group target sum is within 1pp of 100%', async () => {
    mockAssetTypes.push(
      makeAssetType({ id: 'type-1', name: 'Ações BR', target_pct: 100 }),
    );
    mockGroups.push(
      makeGroup({ id: 'group-1', type_id: 'type-1', name: 'Large Cap', target_pct: 60 }),
      makeGroup({ id: 'group-2', type_id: 'type-1', name: 'Small Cap', target_pct: 40.5 }),
    );

    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    // Group sum is 100.5% — within 1pp tolerance, no warning
    const warnings = screen.queryAllByTestId('target-warning');
    const groupWarning = warnings.find((w) => w.textContent?.includes('grupos'));
    expect(groupWarning).toBeUndefined();
  });
});

// ── T15.3.7: Create asset with all fields ───────────────────

describe('T15.3.7 — Create asset with all fields', () => {
  it('adds a new asset to the tree when create form is submitted', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    // Click [+ Novo Ativo] on first group
    const addAssetBtns = screen.getAllByTestId('add-asset-btn');
    fireEvent.click(addAssetBtns[0]);

    expect(screen.getByTestId('create-asset-form')).toBeInTheDocument();

    // Fill form
    const tickerInput = screen.getByPlaceholderText('Ex: PETR4');
    fireEvent.change(tickerInput, { target: { value: 'ITUB4' } });

    const createBtn = screen.getByText('Criar');
    fireEvent.click(createBtn);

    // Wait for the new asset to appear
    await waitFor(() => {
      expect(screen.getByText('ITUB4')).toBeInTheDocument();
    });
  });
});

// ── T15.3.8: Delete asset with confirm ──────────────────────

describe('T15.3.8 — Delete asset with confirm removes from tree', () => {
  it('shows confirm dialog and removes asset on confirm', async () => {
    seedData();
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    // Click [excluir] on first asset
    const deleteBtns = screen.getAllByTestId('asset-delete-btn');
    fireEvent.click(deleteBtns[0]);

    // ConfirmDialog should appear
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Excluir o ativo "PETR4"/)).toBeInTheDocument();

    // Confirm delete
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    // Asset should be removed
    await waitFor(() => {
      expect(screen.queryByText('PETR4')).not.toBeInTheDocument();
    });
  });
});

// ── T15.3.9: Empty wallet shows empty message ───────────────

describe('T15.3.9 — Empty wallet shows message', () => {
  it('shows "Comece adicionando uma classe de ativo" when no data', async () => {
    // No data seeded — empty arrays
    render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('ativos-tab')).toBeInTheDocument();
    });

    expect(screen.getByText('Comece adicionando uma classe de ativo')).toBeInTheDocument();
    expect(screen.getByTestId('empty-tree')).toBeInTheDocument();
  });
});

// ── T15.3.10: Switch wallet shows different data ────────────

describe('T15.3.10 — Switch wallet shows different data', () => {
  it('reloads data when walletId prop changes', async () => {
    seedData();
    const { rerender } = render(<AtivosTab walletId="wallet-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('PETR4')).toBeInTheDocument();
    });

    // Clear data for new wallet
    mockAssetTypes.length = 0;
    mockGroups.length = 0;
    mockAssets.length = 0;

    // Re-render with different wallet
    rerender(<AtivosTab walletId="wallet-2" userId="user-1" />);

    await waitFor(() => {
      expect(screen.queryByText('PETR4')).not.toBeInTheDocument();
      expect(screen.getByText('Comece adicionando uma classe de ativo')).toBeInTheDocument();
    });
  });
});
