// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DualWeightPanel } from '../../src/components/nexus/DualWeightPanel.js';
import type { Asset, Questionnaire, AssetScore } from '../../src/lib/nexus/types.js';

afterEach(() => {
  cleanup();
});

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
  weight_mode: 'manual',
  manual_weight: 5,
  user_id: 'user-1',
  wallet_id: 'wallet-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const QUESTIONNAIRE: Questionnaire = {
  id: 'q-1',
  name: 'Ações BR',
  asset_type_id: 'type-1',
  questions: [
    { id: 'q1', text: 'Paga dividendos?', weight: 1, sort_order: 1 },
    { id: 'q2', text: 'Endividamento alto?', weight: -1, sort_order: 2 },
  ],
  user_id: 'user-1',
  wallet_id: 'wallet-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const SAVED_SCORE: AssetScore = {
  id: 'score-1',
  asset_id: 'asset-1',
  questionnaire_id: 'q-1',
  answers: [
    { question_id: 'q1', value: true },
    { question_id: 'q2', value: false },
  ],
  total_score: 1,
  user_id: 'user-1',
  wallet_id: 'wallet-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return { ...BASE_ASSET, ...overrides };
}

const noopSave = vi.fn().mockResolvedValue(undefined);
const noopSaveScore = vi.fn().mockResolvedValue(undefined);

function renderPanel(overrides: Partial<Parameters<typeof DualWeightPanel>[0]> = {}) {
  return render(
    <DualWeightPanel
      asset={makeAsset(overrides.asset as Partial<Asset> | undefined)}
      questionnaire={overrides.questionnaire ?? QUESTIONNAIRE}
      savedScore={overrides.savedScore ?? null}
      weightPct={'weightPct' in overrides ? overrides.weightPct! : 55.6}
      onSave={overrides.onSave ?? noopSave}
      onSaveScore={overrides.onSaveScore ?? noopSaveScore}
    />,
  );
}

// ── T14.2.1: Render manual mode ─────────────────────────────

describe('T14.2.1 — Render panel with weight_mode=manual', () => {
  it('shows manual input section when weight_mode=manual', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 5 } });
    expect(screen.getByTestId('manual-input-section')).toBeInTheDocument();
    expect(screen.queryByTestId('questionnaire-section')).not.toBeInTheDocument();
  });

  it('manual radio is checked', () => {
    renderPanel({ asset: { weight_mode: 'manual' } });
    const radios = screen.getAllByRole('radio');
    const manualRadio = radios.find(r => (r as HTMLInputElement).value === 'manual') as HTMLInputElement;
    expect(manualRadio.checked).toBe(true);
  });

  it('shows the numeric input with current manual_weight value', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 7 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;
    expect(input.value).toBe('7');
  });
});

// ── T14.2.2: Render questionnaire mode ──────────────────────

describe('T14.2.2 — Render panel with weight_mode=questionnaire', () => {
  it('shows questionnaire section when weight_mode=questionnaire', () => {
    renderPanel({ asset: { weight_mode: 'questionnaire' } });
    expect(screen.getByTestId('questionnaire-section')).toBeInTheDocument();
    expect(screen.queryByTestId('manual-input-section')).not.toBeInTheDocument();
  });

  it('questionnaire radio is checked', () => {
    renderPanel({ asset: { weight_mode: 'questionnaire' } });
    const radios = screen.getAllByRole('radio');
    const qRadio = radios.find(r => (r as HTMLInputElement).value === 'questionnaire') as HTMLInputElement;
    expect(qRadio.checked).toBe(true);
  });

  it('shows questionnaire score when saved score exists', () => {
    renderPanel({ asset: { weight_mode: 'questionnaire' }, savedScore: SAVED_SCORE });
    expect(screen.getByTestId('questionnaire-score')).toHaveTextContent('1');
    expect(screen.getByText('Editar')).toBeInTheDocument();
  });

  it('shows "Responder" button when no saved score', () => {
    renderPanel({ asset: { weight_mode: 'questionnaire' }, savedScore: null });
    expect(screen.getByText('Responder')).toBeInTheDocument();
  });
});

// ── T14.2.3: Switch from manual to questionnaire ────────────

describe('T14.2.3 — Switch modes updates UI immediately', () => {
  it('switching from manual to questionnaire hides manual input, shows questionnaire', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 5 } });

    // Initially manual
    expect(screen.getByTestId('manual-input-section')).toBeInTheDocument();

    // Switch to questionnaire
    const qRadio = screen.getAllByRole('radio').find(
      r => (r as HTMLInputElement).value === 'questionnaire',
    )!;
    fireEvent.click(qRadio);

    // Now questionnaire is shown, manual is hidden
    expect(screen.queryByTestId('manual-input-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('questionnaire-section')).toBeInTheDocument();
  });

  it('switching from questionnaire to manual hides questionnaire, shows manual input', () => {
    renderPanel({ asset: { weight_mode: 'questionnaire' } });

    // Initially questionnaire
    expect(screen.getByTestId('questionnaire-section')).toBeInTheDocument();

    // Switch to manual
    const manualRadio = screen.getAllByRole('radio').find(
      r => (r as HTMLInputElement).value === 'manual',
    )!;
    fireEvent.click(manualRadio);

    // Now manual is shown
    expect(screen.getByTestId('manual-input-section')).toBeInTheDocument();
    expect(screen.queryByTestId('questionnaire-section')).not.toBeInTheDocument();
  });
});

// ── T14.2.4: Validate manual weight range ───────────────────

describe('T14.2.4 — Manual weight validation', () => {
  it('shows validation error when value > 11', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 5 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '12' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Valor deve estar entre -10 e 11');
  });

  it('shows validation error when value < -10', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 5 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '-11' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Valor deve estar entre -10 e 11');
  });

  it('no validation error for valid values', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 0 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '8' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts boundary value -10', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 0 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '-10' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts boundary value 11', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 0 } });
    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '11' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ── T14.2.5: Persist manual weight ──────────────────────────

describe('T14.2.5 — Save persists weight_mode + manual_weight', () => {
  it('calls onSave with weight_mode=manual and manual_weight on save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderPanel({
      asset: { weight_mode: 'manual', manual_weight: 5 },
      onSave,
    });

    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '7' } });

    const saveBtn = screen.getByText('Salvar');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('asset-1', {
        weight_mode: 'manual',
        manual_weight: 7,
      });
    });
  });

  it('does not save when validation error exists', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderPanel({
      asset: { weight_mode: 'manual', manual_weight: 5 },
      onSave,
    });

    const input = screen.getByLabelText(/Nota \(-10 a 11\)/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });

    const saveBtn = screen.getByText('Salvar');
    fireEvent.click(saveBtn);

    // onSave should not be called — button is disabled
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ── T14.2.6: Mode switch preserves previous data ────────────

describe('T14.2.6 — Mode switch preserves previous mode data', () => {
  it('switching to questionnaire mode does not include manual_weight in save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderPanel({
      asset: { weight_mode: 'manual', manual_weight: 8 },
      onSave,
    });

    // Switch to questionnaire
    const qRadio = screen.getAllByRole('radio').find(
      r => (r as HTMLInputElement).value === 'questionnaire',
    )!;
    fireEvent.click(qRadio);

    // Save
    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('asset-1', {
        weight_mode: 'questionnaire',
      });
    });

    // manual_weight should NOT be in the update payload (preserves old value)
    const callArgs = onSave.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('manual_weight');
  });
});

// ── T14.2.7: Panel shows current weight percentage ──────────

describe('T14.2.7 — Weight percentage display', () => {
  it('displays weight percentage when provided', () => {
    renderPanel({ weightPct: 55.6 });
    expect(screen.getByTestId('weight-pct')).toHaveTextContent('55.6%');
  });

  it('displays — when weight percentage is null', () => {
    renderPanel({ weightPct: null });
    expect(screen.getByTestId('weight-pct')).toHaveTextContent('—');
  });

  it('displays raw score', () => {
    renderPanel({ asset: { weight_mode: 'manual', manual_weight: 8 } });
    expect(screen.getByTestId('raw-score')).toHaveTextContent('8');
  });
});

// ── Additional: save error handling ─────────────────────────

describe('DualWeightPanel — error handling', () => {
  it('shows error message when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    renderPanel({
      asset: { weight_mode: 'manual', manual_weight: 5 },
      onSave,
    });

    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('rolls back to original mode on save error', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'));
    renderPanel({
      asset: { weight_mode: 'manual', manual_weight: 5 },
      onSave,
    });

    // Switch to questionnaire then save (which fails)
    const qRadio = screen.getAllByRole('radio').find(
      r => (r as HTMLInputElement).value === 'questionnaire',
    )!;
    fireEvent.click(qRadio);

    fireEvent.click(screen.getByText('Salvar'));

    await waitFor(() => {
      // Should roll back to manual mode
      expect(screen.getByTestId('manual-input-section')).toBeInTheDocument();
    });
  });
});

// ── Mode switch + mode labels ───────────────────────────────

describe('DualWeightPanel — mode switch labels', () => {
  it('renders "Nota manual" and "Questionário" labels', () => {
    renderPanel();
    expect(screen.getByText('Nota manual')).toBeInTheDocument();
    expect(screen.getByText('Questionário')).toBeInTheDocument();
  });
});
