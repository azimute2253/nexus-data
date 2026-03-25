// @vitest-environment jsdom
// ============================================================
// Tests for AportesTab + ContributionHistory (Story 15.2)
// T15.2.1–T15.2.7: Pre-fill, calculation, history, weight mode,
// empty state, wallet switch
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AportesTab } from '../../src/components/nexus/AportesTab.js';
import { ContributionHistory } from '../../src/components/nexus/ContributionHistory.js';
import type { Contribution, RebalanceResult } from '../../src/lib/nexus/types.js';

// ── Mock getContributions ──────────────────────────────────

const mockGetContributions = vi.fn<(walletId: string) => Promise<Contribution[]>>();

vi.mock('../../src/lib/nexus/contributions.js', () => ({
  getContributions: (...args: [string]) => mockGetContributions(...args),
}));

// ── Mock wallet-data rebalance + supabase ──────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetRebalance = vi.fn<(...args: any[]) => Promise<{ data: RebalanceResult | null; error: null }>>();

vi.mock('../../src/lib/dashboard/wallet-data.js', () => ({
  getWalletRebalanceRecommendations: (...args: unknown[]) => mockGetRebalance(...args),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  getAnonClient: () => ({}),
}));

// ── Fixtures ───────────────────────────────────────────────

const WALLET_A = 'wallet-a';
const WALLET_B = 'wallet-b';

const CONTRIBUTIONS_WALLET_A: Contribution[] = [
  {
    id: 'c1',
    contributed_at: '2026-03-20T10:00:00Z',
    amount: 5000,
    distribution: {
      contribution: 5000,
      total_spent: 4800,
      total_allocated: 5000,
      total_remainder: 200,
      types: [
        { name: 'Ações BR', allocated: 3000, type_id: 't1', groups: [] },
        { name: 'FIIs', allocated: 2000, type_id: 't2', groups: [] },
      ],
    },
    user_id: 'user-1',
    wallet_id: WALLET_A,
    created_at: '2026-03-20T10:00:00Z',
  },
  {
    id: 'c2',
    contributed_at: '2026-02-15T10:00:00Z',
    amount: 8000,
    distribution: null,
    user_id: 'user-1',
    wallet_id: WALLET_A,
    created_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'c3',
    contributed_at: '2026-01-10T10:00:00Z',
    amount: 3000,
    distribution: null,
    user_id: 'user-1',
    wallet_id: WALLET_A,
    created_at: '2026-01-10T10:00:00Z',
  },
];

const CONTRIBUTIONS_WALLET_B: Contribution[] = [
  {
    id: 'c4',
    contributed_at: '2026-03-01T10:00:00Z',
    amount: 15000,
    distribution: null,
    user_id: 'user-1',
    wallet_id: WALLET_B,
    created_at: '2026-03-01T10:00:00Z',
  },
];

function makeRebalanceResult(contribution: number): RebalanceResult {
  return {
    contribution,
    total_allocated: contribution,
    total_spent: contribution * 0.95,
    total_remainder: contribution * 0.05,
    types: [
      {
        type_id: 't1',
        name: 'Ações BR',
        allocated: contribution * 0.6,
        groups: [
          {
            group_id: 'g1',
            name: 'Large Caps',
            allocated: contribution * 0.6,
            spent: contribution * 0.55,
            remainder: contribution * 0.05,
            assets: [
              {
                asset_id: 'a1',
                ticker: 'PETR4',
                group_id: 'g1',
                ideal_pct: 60,
                allocated_brl: contribution * 0.36,
                shares_to_buy: 10,
                estimated_cost_brl: contribution * 0.33,
                remainder_brl: contribution * 0.03,
                weight_mode: 'manual',
              },
              {
                asset_id: 'a2',
                ticker: 'VALE3',
                group_id: 'g1',
                ideal_pct: 40,
                allocated_brl: contribution * 0.24,
                shares_to_buy: 5,
                estimated_cost_brl: contribution * 0.22,
                remainder_brl: contribution * 0.02,
                weight_mode: 'questionnaire',
              },
            ],
          },
        ],
      },
      {
        type_id: 't2',
        name: 'FIIs',
        allocated: contribution * 0.4,
        groups: [
          {
            group_id: 'g2',
            name: 'Lajes Corp',
            allocated: contribution * 0.4,
            spent: contribution * 0.4,
            remainder: 0,
            assets: [
              {
                asset_id: 'a3',
                ticker: 'HGLG11',
                group_id: 'g2',
                ideal_pct: 100,
                allocated_brl: contribution * 0.4,
                shares_to_buy: 3,
                estimated_cost_brl: contribution * 0.4,
                remainder_brl: 0,
                weight_mode: 'manual',
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Setup ──────────────────────────────────────────────────

beforeEach(() => {
  mockGetContributions.mockReset();
  mockGetRebalance.mockReset();
  mockGetRebalance.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  cleanup();
});

// ── T15.2.1: Input pre-filled with last contribution ───────

describe('AportesTab — input pre-fill', () => {
  it('T15.2.1 — pre-fills input with last contribution amount (R$ 5.000)', async () => {
    mockGetContributions.mockResolvedValue(CONTRIBUTIONS_WALLET_A);
    const onCalculate = vi.fn().mockResolvedValue(makeRebalanceResult(5000));

    render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    // Wait for contributions to load and component to re-render with default
    await waitFor(() => {
      const input = screen.getByLabelText(/valor do aporte/i);
      expect(input).toHaveValue('5.000');
    });
  });

  // ── T15.2.2: Default when no contributions ─────────────

  it('T15.2.2 — pre-fills input with R$ 12.000 when no contributions exist', async () => {
    mockGetContributions.mockResolvedValue([]);
    const onCalculate = vi.fn().mockResolvedValue(makeRebalanceResult(12000));

    render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    await waitFor(() => {
      const input = screen.getByLabelText(/valor do aporte/i);
      expect(input).toHaveValue('12.000');
    });
  });
});

// ── T15.2.3: Calculate shows hierarchical result ───────────

describe('AportesTab — calculation result', () => {
  it('T15.2.3 — shows L1→L2→L3 result after calculation', async () => {
    mockGetContributions.mockResolvedValue([]);
    const result = makeRebalanceResult(10000);
    mockGetRebalance.mockResolvedValue({ data: result, error: null });

    render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    await waitFor(() => {
      // L1: type names visible
      expect(screen.getByText('Ações BR')).toBeInTheDocument();
      expect(screen.getByText('FIIs')).toBeInTheDocument();
    }, { timeout: 3000 });

    // L2: group names visible
    expect(screen.getByText('Large Caps')).toBeInTheDocument();
    expect(screen.getByText('Lajes Corp')).toBeInTheDocument();
  });
});

// ── T15.2.4: Weight mode indicator on L3 assets ───────────

describe('AportesTab — weight mode indicator', () => {
  it('T15.2.4 — shows weight mode indicator per asset: (manual) or (questionário)', async () => {
    mockGetContributions.mockResolvedValue([]);
    const result = makeRebalanceResult(10000);
    mockGetRebalance.mockResolvedValue({ data: result, error: null });

    render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    // Wait for the results to render (L1 types are visible by default)
    await waitFor(() => {
      expect(screen.getByText('Ações BR')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Expand L2 group buttons (collapsed by default, aria-expanded="false")
    const collapsedButtons = screen.getAllByRole('button', { expanded: false });
    for (const btn of collapsedButtons) {
      fireEvent.click(btn);
    }

    // Now L3 asset rows with tickers and weight indicators should be visible
    await waitFor(() => {
      expect(screen.getByText('PETR4')).toBeInTheDocument();
      expect(screen.getByText('VALE3')).toBeInTheDocument();
    });

    // Check (manual) and (questionário) indicators
    const manualIndicators = screen.getAllByText('(manual)');
    const questionnaireIndicators = screen.getAllByText('(questionário)');
    expect(manualIndicators.length).toBeGreaterThanOrEqual(1);
    expect(questionnaireIndicators.length).toBeGreaterThanOrEqual(1);
  });
});

// ── T15.2.5: History shows entries in reverse order ────────

describe('ContributionHistory — display', () => {
  it('T15.2.5 — shows 3 entries newest first', () => {
    render(<ContributionHistory contributions={CONTRIBUTIONS_WALLET_A} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    // First entry should be the newest (R$ 5.000 from March)
    expect(within(items[0]).getByText(/5\.000/)).toBeInTheDocument();
    // Last entry should be the oldest (R$ 3.000 from January)
    expect(within(items[2]).getByText(/3\.000/)).toBeInTheDocument();
  });

  it('shows distribution snapshot when available', () => {
    render(<ContributionHistory contributions={CONTRIBUTIONS_WALLET_A} />);

    // First contribution has distribution with type allocations
    expect(screen.getByText(/Ações BR/)).toBeInTheDocument();
    expect(screen.getByText(/FIIs/)).toBeInTheDocument();
  });
});

// ── T15.2.6: Empty state ──────────────────────────────────

describe('ContributionHistory — empty state', () => {
  it('T15.2.6 — shows empty message when no contributions', () => {
    render(<ContributionHistory contributions={[]} />);
    expect(screen.getByText('Nenhum aporte registrado ainda')).toBeInTheDocument();
  });
});

// ── T15.2.7: Wallet switch updates data ───────────────────

describe('AportesTab — wallet switch', () => {
  it('T15.2.7 — updates contributions when wallet changes', async () => {
    mockGetContributions
      .mockResolvedValueOnce(CONTRIBUTIONS_WALLET_A)
      .mockResolvedValueOnce(CONTRIBUTIONS_WALLET_B);
    const onCalculate = vi.fn().mockResolvedValue(makeRebalanceResult(12000));

    const { rerender } = render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    // Wait for wallet A contributions to load
    await waitFor(() => {
      expect(mockGetContributions).toHaveBeenCalledWith(WALLET_A);
    });

    // Switch to wallet B
    rerender(
      <AportesTab
        walletId={WALLET_B}
        userId="user-1"
      />,
    );

    // Should fetch wallet B contributions
    await waitFor(() => {
      expect(mockGetContributions).toHaveBeenCalledWith(WALLET_B);
    });
  });
});

// ── ContributionHistory — loading state ────────────────────

describe('ContributionHistory — loading', () => {
  it('shows skeleton when loading', () => {
    render(<ContributionHistory contributions={[]} isLoading={true} />);
    expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
  });
});

// ── AportesTab — renders all sections ─────────────────────

describe('AportesTab — structure', () => {
  it('renders calculator input, button, and history section', async () => {
    mockGetContributions.mockResolvedValue([]);
    const onCalculate = vi.fn().mockResolvedValue(makeRebalanceResult(12000));

    render(
      <AportesTab
        walletId={WALLET_A}
        userId="user-1"
      />,
    );

    await waitFor(() => {
      // Input field
      expect(screen.getByLabelText(/valor do aporte/i)).toBeInTheDocument();
      // Calculate button
      expect(screen.getByRole('button', { name: /calcular/i })).toBeInTheDocument();
      // History section header
      expect(screen.getByText(/histórico de aportes/i)).toBeInTheDocument();
    });
  });
});
