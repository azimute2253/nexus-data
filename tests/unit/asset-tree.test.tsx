// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AssetTree } from '../../src/components/nexus/AssetTree.js';
import { TargetWarning } from '../../src/components/nexus/TargetWarning.js';
import { AssetNode } from '../../src/components/nexus/AssetTreeNode.js';
import type { Asset, AssetType, AssetGroup } from '../../src/lib/nexus/types.js';

afterEach(() => {
  cleanup();
});

// ── Helpers ─────────────────────────────────────────────────

function makeAssetType(overrides: Partial<AssetType> = {}): AssetType {
  return {
    id: 'type-1',
    name: 'Ações BR',
    target_pct: 50,
    sort_order: 1,
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '',
    updated_at: '',
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
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    ticker: 'PETR4',
    name: 'Petrobras',
    sector: null,
    quantity: 10,
    group_id: 'group-1',
    price_source: 'brapi',
    is_active: true,
    manual_override: false,
    whole_shares: true,
    bought: false,
    sold: false,
    weight_mode: 'manual',
    manual_weight: 5,
    user_id: 'user-1',
    wallet_id: 'wallet-1',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const noopAsync = vi.fn().mockResolvedValue(undefined);
const noopVoid = vi.fn();

function renderTree(
  types: AssetType[] = [],
  groups: AssetGroup[] = [],
  assets: Asset[] = [],
) {
  return render(
    <AssetTree
      assetTypes={types}
      groups={groups}
      assets={assets}
      walletId="wallet-1"
      userId="user-1"
      onCreateClass={noopAsync}
      onUpdateClass={noopAsync}
      onDeleteClass={noopVoid}
      onCreateGroup={noopAsync}
      onUpdateGroup={noopAsync}
      onDeleteGroup={noopVoid}
      onCreateAsset={noopAsync}
      onEditAsset={noopVoid}
      onDeleteAsset={noopVoid}
    />,
  );
}

// ── Tree rendering ──────────────────────────────────────────

describe('AssetTree — rendering', () => {
  it('renders empty state when no classes exist', () => {
    renderTree();
    expect(screen.getByTestId('empty-tree')).toBeInTheDocument();
    expect(screen.getByText('Comece adicionando uma classe de ativo')).toBeInTheDocument();
  });

  it('renders class nodes with target percentage', () => {
    renderTree([makeAssetType({ name: 'Ações', target_pct: 40 })]);
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('(Target: 40%)')).toBeInTheDocument();
  });

  it('renders groups within expanded classes', () => {
    const types = [makeAssetType()];
    const groups = [makeGroup({ name: 'Large Cap', target_pct: 60 })];
    renderTree(types, groups);

    expect(screen.getByText('Large Cap')).toBeInTheDocument();
    expect(screen.getByText('— 60%')).toBeInTheDocument();
  });

  it('renders assets within expanded groups', () => {
    const types = [makeAssetType()];
    const groups = [makeGroup()];
    const assets = [makeAsset({ ticker: 'VALE3', manual_weight: 7 })];
    renderTree(types, groups, assets);

    expect(screen.getByText('VALE3')).toBeInTheDocument();
  });
});

// ── Collapse/expand ─────────────────────────────────────────

describe('AssetTree — collapse/expand', () => {
  it('hides groups when class is collapsed', () => {
    const types = [makeAssetType()];
    const groups = [makeGroup({ name: 'Large Cap' })];
    const assets = [makeAsset()];
    renderTree(types, groups, assets);

    // Initially expanded — group is visible
    expect(screen.getByText('Large Cap')).toBeInTheDocument();

    // Click collapse on class
    const expandBtn = screen.getAllByRole('button', { name: /Recolher|Expandir/ })[0];
    fireEvent.click(expandBtn);

    // Group should be hidden
    expect(screen.queryByText('Large Cap')).not.toBeInTheDocument();
  });

  it('shows groups again when re-expanded', () => {
    const types = [makeAssetType()];
    const groups = [makeGroup({ name: 'Large Cap' })];
    renderTree(types, groups);

    const expandBtn = screen.getAllByRole('button', { name: /Recolher|Expandir/ })[0];

    // Collapse
    fireEvent.click(expandBtn);
    expect(screen.queryByText('Large Cap')).not.toBeInTheDocument();

    // Re-expand
    fireEvent.click(expandBtn);
    expect(screen.getByText('Large Cap')).toBeInTheDocument();
  });
});

// ── Create form visibility ──────────────────────────────────

describe('AssetTree — create forms', () => {
  it('shows create class form when add button is clicked', () => {
    renderTree();
    fireEvent.click(screen.getByTestId('add-class-btn'));
    expect(screen.getByTestId('create-class-form')).toBeInTheDocument();
  });

  it('shows create group form when add button is clicked', () => {
    const types = [makeAssetType()];
    renderTree(types);

    const addGroupBtn = screen.getByTestId('add-group-btn');
    fireEvent.click(addGroupBtn);
    expect(screen.getByTestId('create-group-form')).toBeInTheDocument();
  });

  it('shows create asset form when add button is clicked', () => {
    const types = [makeAssetType()];
    const groups = [makeGroup()];
    renderTree(types, groups);

    const addAssetBtn = screen.getByTestId('add-asset-btn');
    fireEvent.click(addAssetBtn);
    expect(screen.getByTestId('create-asset-form')).toBeInTheDocument();
  });
});

// ── TargetWarning component ─────────────────────────────────

describe('TargetWarning — rendering', () => {
  it('shows warning when sum differs from 100%', () => {
    render(<TargetWarning sum={90} label="das classes" />);
    expect(screen.getByTestId('target-warning')).toBeInTheDocument();
    expect(screen.getByText(/90\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/abaixo/)).toBeInTheDocument();
  });

  it('shows warning for sums above 100%', () => {
    render(<TargetWarning sum={110} label="das classes" />);
    expect(screen.getByText(/110\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/acima/)).toBeInTheDocument();
  });

  it('does not show warning when sum equals 100%', () => {
    render(<TargetWarning sum={100} label="das classes" />);
    expect(screen.queryByTestId('target-warning')).not.toBeInTheDocument();
  });

  it('respects tolerance parameter', () => {
    // 100.5% with 1pp tolerance — should not show
    render(<TargetWarning sum={100.5} label="dos grupos" tolerancePp={1} />);
    expect(screen.queryByTestId('target-warning')).not.toBeInTheDocument();
  });

  it('shows warning when exceeding tolerance', () => {
    // 102% with 1pp tolerance — should show
    render(<TargetWarning sum={102} label="dos grupos" tolerancePp={1} />);
    expect(screen.getByTestId('target-warning')).toBeInTheDocument();
  });
});

// ── AssetNode — weight display ──────────────────────────────

describe('AssetNode — weight display', () => {
  it('shows manual weight with (manual) label', () => {
    render(
      <AssetNode
        asset={makeAsset({ weight_mode: 'manual', manual_weight: 5 })}
        onEdit={noopVoid}
        onDelete={noopVoid}
      />,
    );
    expect(screen.getByTestId('asset-weight-display')).toHaveTextContent('peso: 5 (manual)');
  });

  it('shows — with (questionário) label for questionnaire mode', () => {
    render(
      <AssetNode
        asset={makeAsset({ weight_mode: 'questionnaire', manual_weight: 5 })}
        onEdit={noopVoid}
        onDelete={noopVoid}
      />,
    );
    expect(screen.getByTestId('asset-weight-display')).toHaveTextContent('peso: — (questionário)');
  });

  it('calls onEdit when [editar] is clicked', () => {
    const onEdit = vi.fn();
    const asset = makeAsset();
    render(<AssetNode asset={asset} onEdit={onEdit} onDelete={noopVoid} />);
    fireEvent.click(screen.getByTestId('asset-edit-btn'));
    expect(onEdit).toHaveBeenCalledWith(asset);
  });

  it('calls onDelete when [excluir] is clicked', () => {
    const onDelete = vi.fn();
    render(<AssetNode asset={makeAsset()} onEdit={noopVoid} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('asset-delete-btn'));
    expect(onDelete).toHaveBeenCalledWith('asset-1');
  });
});
