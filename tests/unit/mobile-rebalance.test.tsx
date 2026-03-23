// @vitest-environment jsdom

// ============================================================
// Nexus Data — Mobile Rebalance Component Tests
// Rendering tests for MobileRebalance + OrderBottomSheet using
// @testing-library/react. Validates mobile UX requirements:
// numeric keyboard, thumb-friendly buttons, card styling, and
// 2-tap flow.
// [Story 8.2]
// ============================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MobileRebalance } from '../../src/components/mobile/MobileRebalance.js';
import { OrderBottomSheet } from '../../src/components/mobile/OrderBottomSheet.js';
import type { RebalanceResult } from '../../src/lib/nexus/types.js';

afterEach(cleanup);

// ── Fixtures ────────────────────────────────────────────────

const RESULT: RebalanceResult = {
  contribution: 12000,
  total_allocated: 12000,
  total_spent: 11847.5,
  total_remainder: 152.5,
  types: [
    {
      type_id: 't1',
      name: 'Ações BR',
      allocated: 8000,
      groups: [
        {
          group_id: 'g1',
          name: 'Dividendos',
          allocated: 4800,
          spent: 4650,
          remainder: 150,
          assets: [
            {
              asset_id: 'a1', ticker: 'VALE3', group_id: 'g1',
              ideal_pct: 60, allocated_brl: 2880, shares_to_buy: 5,
              estimated_cost_brl: 2750, remainder_brl: 130,
            },
            {
              asset_id: 'a2', ticker: 'PETR4', group_id: 'g1',
              ideal_pct: 40, allocated_brl: 1920, shares_to_buy: 3,
              estimated_cost_brl: 1900, remainder_brl: 20,
            },
          ],
        },
        {
          group_id: 'g2',
          name: 'Crescimento',
          allocated: 3200,
          spent: 3197.5,
          remainder: 2.5,
          assets: [
            {
              asset_id: 'a3', ticker: 'WEGE3', group_id: 'g2',
              ideal_pct: 100, allocated_brl: 3200, shares_to_buy: 7,
              estimated_cost_brl: 3197.5, remainder_brl: 2.5,
            },
          ],
        },
      ],
    },
    {
      type_id: 't2',
      name: 'FIIs',
      allocated: 4000,
      groups: [
        {
          group_id: 'g3',
          name: 'Logístico',
          allocated: 4000,
          spent: 4000,
          remainder: 0,
          assets: [
            {
              asset_id: 'a4', ticker: 'HGLG11', group_id: 'g3',
              ideal_pct: 100, allocated_brl: 4000, shares_to_buy: 25,
              estimated_cost_brl: 4000, remainder_brl: 0,
            },
          ],
        },
      ],
    },
  ],
};

const mockOnCalculate = vi.fn().mockResolvedValue(RESULT);

// ── Tests: MobileRebalance — Input / Button rendering ───────

describe('MobileRebalance', () => {
  it('T8.2.1 — renders input and Calcular button visible', () => {
    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    const input = screen.getByLabelText(/valor do aporte/i);
    expect(input).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /calcular/i });
    expect(button).toBeInTheDocument();
  });

  it('T8.2.4 — input has inputmode="decimal" for numeric keyboard', () => {
    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    const input = screen.getByLabelText(/valor do aporte/i);
    expect(input).toHaveAttribute('inputMode', 'decimal');
  });

  it('AC2 — Calcular button meets minimum 44x44px touch target', () => {
    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    const button = screen.getByRole('button', { name: /calcular/i });
    const style = button.style;
    const minHeight = parseInt(style.minHeight, 10);
    const minWidth = parseInt(style.minWidth, 10);
    expect(minHeight).toBeGreaterThanOrEqual(44);
    expect(minWidth).toBeGreaterThanOrEqual(44);
  });

  it('T8.2.2 — 2-tap flow: type value → tap Calcular → shows result', async () => {
    mockOnCalculate.mockResolvedValueOnce(RESULT);

    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    // Tap 1: focus input and type value
    const input = screen.getByLabelText(/valor do aporte/i);
    fireEvent.change(input, { target: { value: '12.000' } });

    // Tap 2: tap Calcular
    const button = screen.getByRole('button', { name: /calcular/i });
    fireEvent.click(button);

    // Result appears in bottom sheet
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Orders visible
    expect(screen.getByText('VALE3')).toBeInTheDocument();
    expect(screen.getByText('PETR4')).toBeInTheDocument();
    expect(screen.getByText('WEGE3')).toBeInTheDocument();
    expect(screen.getByText('HGLG11')).toBeInTheDocument();
  });

  it('T8.2.5 — shows validation error for non-numeric input', () => {
    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    const input = screen.getByLabelText(/valor do aporte/i);
    fireEvent.change(input, { target: { value: 'abc' } });

    const error = screen.getByRole('alert');
    expect(error).toBeInTheDocument();
    expect(error).toHaveTextContent(/valor numérico válido/i);

    // Button should be disabled
    const button = screen.getByRole('button', { name: /calcular/i });
    expect(button).toBeDisabled();
  });

  it('T8.2.5 — shows validation error for zero value', () => {
    render(
      <MobileRebalance
        initialResult={null}
        defaultContribution={0}
        onCalculate={mockOnCalculate}
      />,
    );

    const input = screen.getByLabelText(/valor do aporte/i);
    fireEvent.change(input, { target: { value: '0' } });

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent(/maior que zero/i);
  });

  it('shows error state when calculation fails', async () => {
    mockOnCalculate.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MobileRebalance
        initialResult={null}
        onCalculate={mockOnCalculate}
      />,
    );

    const input = screen.getByLabelText(/valor do aporte/i);
    fireEvent.change(input, { target: { value: '12.000' } });

    const button = screen.getByRole('button', { name: /calcular/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('shows peek summary when bottom sheet is closed', async () => {
    render(
      <MobileRebalance
        initialResult={RESULT}
        onCalculate={mockOnCalculate}
      />,
    );

    // Should show summary button (sheet starts closed when result comes from initialResult)
    const summary = screen.getByText(/4 ordens de compra/i);
    expect(summary).toBeInTheDocument();
  });

  it('opens bottom sheet when tapping peek summary', async () => {
    render(
      <MobileRebalance
        initialResult={RESULT}
        onCalculate={mockOnCalculate}
      />,
    );

    const summary = screen.getByText(/4 ordens de compra/i);
    fireEvent.click(summary.closest('button')!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('displays initial error from props', () => {
    render(
      <MobileRebalance
        initialResult={null}
        initialError="Server error"
        onCalculate={mockOnCalculate}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Server error');
  });
});

// ── Tests: OrderBottomSheet — Card rendering ────────────────

describe('OrderBottomSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OrderBottomSheet result={RESULT} open={false} onClose={vi.fn()} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when open', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('T8.2.3 — order cards have font-size >= 14px', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    // Check that all dt and dd elements in order cards have the right style
    const items = screen.getAllByRole('listitem');
    for (const item of items) {
      const dts = item.querySelectorAll('dt');
      const dds = item.querySelectorAll('dd');
      for (const el of [...dts, ...dds]) {
        const fontSize = parseInt((el as HTMLElement).style.fontSize, 10);
        expect(fontSize).toBeGreaterThanOrEqual(14);
      }
    }
  });

  it('T8.2.3 — order cards have line-height >= 1.4', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    const items = screen.getAllByRole('listitem');
    for (const item of items) {
      const dts = item.querySelectorAll('dt');
      const dds = item.querySelectorAll('dd');
      for (const el of [...dts, ...dds]) {
        const lineHeight = parseFloat((el as HTMLElement).style.lineHeight);
        expect(lineHeight).toBeGreaterThanOrEqual(1.4);
      }
    }
  });

  it('displays all buy order tickers', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText('VALE3')).toBeInTheDocument();
    expect(screen.getByText('PETR4')).toBeInTheDocument();
    expect(screen.getByText('WEGE3')).toBeInTheDocument();
    expect(screen.getByText('HGLG11')).toBeInTheDocument();
  });

  it('displays shares and cost per order card', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    // VALE3: 5 shares
    expect(screen.getByText('5')).toBeInTheDocument();
    // PETR4: 3 shares
    expect(screen.getByText('3')).toBeInTheDocument();
    // HGLG11: 25 shares
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('shows correct order count in header', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/4 ordens de compra/i)).toBeInTheDocument();
  });

  it('shows summary bar with contribution and totals', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText('Aporte')).toBeInTheDocument();
    expect(screen.getByText('Investido')).toBeInTheDocument();
    expect(screen.getByText('Alocado')).toBeInTheDocument();
    expect(screen.getByText('Troco')).toBeInTheDocument();
  });

  it('close button meets 44x44px minimum', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    const closeBtn = screen.getByLabelText('Fechar');
    const minHeight = parseInt(closeBtn.style.minHeight, 10);
    const minWidth = parseInt(closeBtn.style.minWidth, 10);
    expect(minHeight).toBeGreaterThanOrEqual(44);
    expect(minWidth).toBeGreaterThanOrEqual(44);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={onClose} />,
    );

    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={onClose} />,
    );

    // Backdrop is the first element with aria-hidden
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows empty state when no orders', () => {
    const emptyResult: RebalanceResult = {
      contribution: 1000,
      total_allocated: 0,
      total_spent: 0,
      total_remainder: 1000,
      types: [],
    };

    render(
      <OrderBottomSheet result={emptyResult} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/nenhuma ordem/i)).toBeInTheDocument();
  });

  it('uses singular "ordem" for single order', () => {
    const singleResult: RebalanceResult = {
      contribution: 1000,
      total_allocated: 1000,
      total_spent: 900,
      total_remainder: 100,
      types: [{
        type_id: 't1', name: 'Test', allocated: 1000,
        groups: [{
          group_id: 'g1', name: 'G', allocated: 1000, spent: 900, remainder: 100,
          assets: [{
            asset_id: 'a1', ticker: 'TEST3', group_id: 'g1',
            ideal_pct: 100, allocated_brl: 1000, shares_to_buy: 2,
            estimated_cost_brl: 900, remainder_brl: 100,
          }],
        }],
      }],
    };

    render(
      <OrderBottomSheet result={singleResult} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/1 ordem de compra/i)).toBeInTheDocument();
  });

  it('shows group name on each card without truncation', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    // "Dividendos" appears twice (VALE3 + PETR4 share the same group)
    const dividendos = screen.getAllByText('Dividendos');
    expect(dividendos).toHaveLength(2);
    expect(screen.getByText('Crescimento')).toBeInTheDocument();
    expect(screen.getByText('Logístico')).toBeInTheDocument();
  });

  it('has aria-modal and aria-label for accessibility', () => {
    render(
      <OrderBottomSheet result={RESULT} open={true} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Ordens de compra');
  });
});
