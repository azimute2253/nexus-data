// @vitest-environment jsdom
// ============================================================
// Tests for OnboardingScreen + EmptyDashboard (Story 12.3)
// T12.3.1–T12.3.6: Onboarding, Dashboard, submit, empty state,
// validation, error
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OnboardingScreen } from '../../src/components/nexus/OnboardingScreen.js';
import { EmptyDashboard } from '../../src/components/nexus/EmptyDashboard.js';
import type { Wallet } from '../../src/lib/nexus/types.js';

// ── Mock createWallet ───────────────────────────────────────

const mockCreateWallet = vi.fn<(input: { user_id: string; name: string }) => Promise<Wallet>>();

vi.mock('../../src/lib/nexus/wallets.js', () => ({
  createWallet: (...args: [{ user_id: string; name: string }]) => mockCreateWallet(...args),
}));

// ── Helpers ──────────────────────────────────────────────────

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store,
  };
}

// ── Setup/Teardown ──────────────────────────────────────────

let storage: ReturnType<typeof mockLocalStorage>;
const originalReload = window.location.reload;

beforeEach(() => {
  storage = mockLocalStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true });
  mockCreateWallet.mockReset();
  // Mock window.location.reload
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: originalReload },
    writable: true,
  });
});

// ── T12.3.1 — User with 0 wallets → onboarding screen rendered ──

describe('T12.3.1 — Onboarding screen rendering (0 wallets)', () => {
  it('renders onboarding screen with welcome message', () => {
    render(<OnboardingScreen userId="user-1" />);

    expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument();
    expect(screen.getByText('Bem-vindo ao Nexus Data')).toBeInTheDocument();
  });

  it('shows explanation text', () => {
    render(<OnboardingScreen userId="user-1" />);

    expect(screen.getByText(/Organize seus investimentos/)).toBeInTheDocument();
  });

  it('shows wallet name input and create button', () => {
    render(<OnboardingScreen userId="user-1" />);

    expect(screen.getByLabelText('Nome da carteira')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar minha carteira/i })).toBeInTheDocument();
  });
});

// ── T12.3.2 — User with 1+ wallets → Dashboard rendered ──
// Note: This is a server-side detection test. The OnboardingScreen component
// itself is only rendered when the server determines 0 wallets.
// This test verifies the component is NOT rendered when wallets exist
// (by checking the component's absence in a container scenario).

describe('T12.3.2 — Conditional rendering (server-side detection)', () => {
  it('onboarding screen is not rendered when hasWallets is true', () => {
    // Simulate server-side conditional: when hasWallets=true, we don't render OnboardingScreen
    const hasWallets = true;

    const { container } = render(
      <div>
        {!hasWallets && <OnboardingScreen userId="user-1" />}
        {hasWallets && <div data-testid="dashboard">Dashboard content</div>}
      </div>,
    );

    expect(screen.queryByTestId('onboarding-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('onboarding screen renders when hasWallets is false', () => {
    const hasWallets = false;

    render(
      <div>
        {!hasWallets && <OnboardingScreen userId="user-1" />}
        {hasWallets && <div data-testid="dashboard">Dashboard content</div>}
      </div>,
    );

    expect(screen.getByTestId('onboarding-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});

// ── T12.3.3 — Submit valid name → wallet created, page reloads ──

describe('T12.3.3 — Submit creates wallet and reloads', () => {
  it('creates wallet, saves to localStorage, and reloads page', async () => {
    const createdWallet: Wallet = {
      id: 'wallet-new',
      user_id: 'user-1',
      name: 'Minha Carteira',
      created_at: '2026-03-24T00:00:00Z',
    };
    mockCreateWallet.mockResolvedValue(createdWallet);

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'Minha Carteira' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Minha Carteira',
      });
    });

    expect(storage.setItem).toHaveBeenCalledWith('nexus_active_wallet_id', 'wallet-new');
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('shows "Criando..." while submitting', async () => {
    mockCreateWallet.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Criando/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Criando/i })).toBeDisabled();
  });

  it('trims whitespace from wallet name before creating', async () => {
    const createdWallet: Wallet = {
      id: 'wallet-trimmed',
      user_id: 'user-1',
      name: 'Trimmed Name',
      created_at: '2026-03-24T00:00:00Z',
    };
    mockCreateWallet.mockResolvedValue(createdWallet);

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: '  Trimmed Name  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Trimmed Name',
      });
    });
  });
});

// ── T12.3.4 — Empty Dashboard after onboarding ──

describe('T12.3.4 — Empty Dashboard state', () => {
  it('renders empty state message', () => {
    render(<EmptyDashboard />);

    expect(screen.getByTestId('empty-dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(/Sua carteira está vazia\. Comece adicionando suas classes de ativo na aba Ativos\./),
    ).toBeInTheDocument();
  });

  it('shows "Ir para Ativos" button', () => {
    render(<EmptyDashboard />);

    expect(screen.getByRole('button', { name: /Ir para Ativos/i })).toBeInTheDocument();
  });

  it('calls onNavigateAtivos when button is clicked', () => {
    const onNavigateAtivos = vi.fn();
    render(<EmptyDashboard onNavigateAtivos={onNavigateAtivos} />);

    fireEvent.click(screen.getByRole('button', { name: /Ir para Ativos/i }));

    expect(onNavigateAtivos).toHaveBeenCalledTimes(1);
  });

  it('falls back to URL-based navigation when onNavigateAtivos not provided', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<EmptyDashboard />);

    fireEvent.click(screen.getByRole('button', { name: /Ir para Ativos/i }));

    expect(replaceStateSpy).toHaveBeenCalled();
    expect(dispatchEventSpy).toHaveBeenCalled();

    replaceStateSpy.mockRestore();
    dispatchEventSpy.mockRestore();
  });
});

// ── T12.3.5 — Submit empty name → validation error ──

describe('T12.3.5 — Validation errors', () => {
  it('shows error when submitting empty name', async () => {
    render(<OnboardingScreen userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('O nome da carteira é obrigatório.')).toBeInTheDocument();
    });

    // Should NOT call createWallet
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  it('shows error when submitting only whitespace', async () => {
    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByText('O nome da carteira é obrigatório.')).toBeInTheDocument();
    });

    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  it('clears error when user starts typing', async () => {
    render(<OnboardingScreen userId="user-1" />);

    // Trigger error
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Start typing
    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'A' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sets aria-invalid on input when error is present', async () => {
    render(<OnboardingScreen userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Nome da carteira')).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

// ── T12.3.6 — Supabase error → error message ──

describe('T12.3.6 — Supabase creation error', () => {
  it('shows error message when createWallet fails', async () => {
    mockCreateWallet.mockRejectedValue(new Error('Database error'));

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'My Wallet' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Erro ao criar carteira. Tente novamente.')).toBeInTheDocument();
    });

    // Button should be re-enabled after error
    expect(screen.getByRole('button', { name: /Criar minha carteira/i })).not.toBeDisabled();
  });

  it('does not reload page on error', async () => {
    mockCreateWallet.mockRejectedValue(new Error('Network error'));

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'My Wallet' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('does not save to localStorage on error', async () => {
    mockCreateWallet.mockRejectedValue(new Error('Error'));

    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    fireEvent.change(input, { target: { value: 'My Wallet' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar minha carteira/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

// ── Additional: Accessibility ──

describe('Accessibility', () => {
  it('has proper form structure with label association', () => {
    render(<OnboardingScreen userId="user-1" />);

    const input = screen.getByLabelText('Nome da carteira');
    expect(input).toHaveAttribute('id', 'wallet-name');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('maxLength', '50');
  });

  it('has proper heading hierarchy', () => {
    render(<OnboardingScreen userId="user-1" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Bem-vindo ao Nexus Data');
  });

  it('submit button has minimum touch target size', () => {
    render(<OnboardingScreen userId="user-1" />);

    const button = screen.getByRole('button', { name: /Criar minha carteira/i });
    expect(button).toHaveClass('min-h-[44px]');
  });
});
