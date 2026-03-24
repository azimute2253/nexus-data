// @vitest-environment jsdom
// ============================================================
// Tests for WalletSelector component (Story 12.1)
// T12.1.1–T12.1.6: Dropdown, static, switch, persist, fallback, button
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WalletSelector } from '../../src/components/nexus/WalletSelector.js';
import type { Wallet } from '../../src/lib/nexus/types.js';

// ── Mock getWallets ──────────────────────────────────────────

const mockGetWallets = vi.fn<(userId: string) => Promise<Wallet[]>>();

vi.mock('../../src/lib/nexus/wallets.js', () => ({
  getWallets: (...args: [string]) => mockGetWallets(...args),
}));

// ── Test data ────────────────────────────────────────────────

const WALLET_A: Wallet = {
  id: 'wallet-aaa',
  user_id: 'user-1',
  name: 'Carteira Principal',
  created_at: '2026-01-01T00:00:00Z',
};

const WALLET_B: Wallet = {
  id: 'wallet-bbb',
  user_id: 'user-1',
  name: 'Reserva de Emergência',
  created_at: '2026-02-01T00:00:00Z',
};

const WALLET_C: Wallet = {
  id: 'wallet-ccc',
  user_id: 'user-1',
  name: 'Investimento Internacional',
  created_at: '2026-03-01T00:00:00Z',
};

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

// ── Setup/Teardown ───────────────────────────────────────────

let storage: ReturnType<typeof mockLocalStorage>;

beforeEach(() => {
  storage = mockLocalStorage();
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true });
  mockGetWallets.mockReset();
});

afterEach(() => {
  cleanup();
});

// ── T12.1.1 — User with 3 wallets → dropdown with 3 options ──

describe('T12.1.1 — Dropdown rendering (multiple wallets)', () => {
  it('renders dropdown with 3 wallet options', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B, WALLET_C]);

    render(
      <WalletSelector userId="user-1" onCreateWallet={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));

    // Verify 3 wallet items in listbox
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Carteira Principal');
    expect(options[1]).toHaveTextContent('Reserva de Emergência');
    expect(options[2]).toHaveTextContent('Investimento Internacional');
  });

  it('displays wallets ordered by created_at (server order preserved)', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B, WALLET_C]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent(WALLET_A.name);
    expect(options[1]).toHaveTextContent(WALLET_B.name);
    expect(options[2]).toHaveTextContent(WALLET_C.name);
  });
});

// ── T12.1.2 — User with 1 wallet → static text, no dropdown ──

describe('T12.1.2 — Static text (single wallet)', () => {
  it('renders static text with wallet name, no dropdown trigger', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-static')).toBeInTheDocument();
    });

    expect(screen.getByText('Carteira Principal')).toBeInTheDocument();

    // No dropdown trigger should exist
    expect(screen.queryByRole('button', { name: /Selecionar carteira/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('wallet-selector-dropdown')).not.toBeInTheDocument();
  });
});

// ── T12.1.3 — Select wallet B → data refreshes to wallet B ──

describe('T12.1.3 — Wallet switch triggers onWalletChange', () => {
  it('calls onWalletChange with selected wallet', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B, WALLET_C]);
    const onWalletChange = vi.fn();

    render(
      <WalletSelector userId="user-1" onWalletChange={onWalletChange} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Initial load calls onWalletChange with first wallet
    expect(onWalletChange).toHaveBeenCalledWith(WALLET_A);
    onWalletChange.mockClear();

    // Open dropdown and select wallet B
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));
    fireEvent.click(screen.getByText('Reserva de Emergência'));

    expect(onWalletChange).toHaveBeenCalledTimes(1);
    expect(onWalletChange).toHaveBeenCalledWith(WALLET_B);
  });

  it('closes dropdown after selection', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Select wallet B
    fireEvent.click(screen.getByText('Reserva de Emergência'));

    // Dropdown should close
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('updates displayed wallet name after switch', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Selecionar carteira/i })).toHaveTextContent('Carteira Principal');
    });

    // Open and select wallet B
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));
    fireEvent.click(screen.getByText('Reserva de Emergência'));

    expect(screen.getByRole('button', { name: /Selecionar carteira/i })).toHaveTextContent('Reserva de Emergência');
  });
});

// ── T12.1.4 — Select wallet → persists to localStorage ──

describe('T12.1.4 — localStorage persistence', () => {
  it('saves active wallet_id to localStorage on selection', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Initial load should persist first wallet
    expect(storage.setItem).toHaveBeenCalledWith('nexus_active_wallet_id', WALLET_A.id);

    // Open and select wallet B
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));
    fireEvent.click(screen.getByText('Reserva de Emergência'));

    expect(storage.setItem).toHaveBeenCalledWith('nexus_active_wallet_id', WALLET_B.id);
  });

  it('reads localStorage on mount and selects stored wallet', async () => {
    storage._store['nexus_active_wallet_id'] = WALLET_B.id;
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B, WALLET_C]);
    const onWalletChange = vi.fn();

    render(
      <WalletSelector userId="user-1" onWalletChange={onWalletChange} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Should have resolved to wallet B from localStorage
    expect(onWalletChange).toHaveBeenCalledWith(WALLET_B);
    expect(screen.getByRole('button', { name: /Selecionar carteira/i })).toHaveTextContent('Reserva de Emergência');
  });
});

// ── T12.1.5 — localStorage has invalid wallet_id → fallback to first ──

describe('T12.1.5 — Invalid localStorage fallback', () => {
  it('falls back to first wallet when stored id is invalid', async () => {
    storage._store['nexus_active_wallet_id'] = 'non-existent-wallet-id';
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);
    const onWalletChange = vi.fn();

    render(
      <WalletSelector userId="user-1" onWalletChange={onWalletChange} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Should fall back to first wallet
    expect(onWalletChange).toHaveBeenCalledWith(WALLET_A);
    expect(screen.getByRole('button', { name: /Selecionar carteira/i })).toHaveTextContent('Carteira Principal');
  });

  it('falls back to first wallet when localStorage is empty', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);
    const onWalletChange = vi.fn();

    render(
      <WalletSelector userId="user-1" onWalletChange={onWalletChange} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    expect(onWalletChange).toHaveBeenCalledWith(WALLET_A);
  });
});

// ── T12.1.6 — "Nova carteira" button visible ──

describe('T12.1.6 — Nova carteira button', () => {
  it('shows "Nova carteira" button in static mode (single wallet)', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A]);
    const onCreateWallet = vi.fn();

    render(
      <WalletSelector userId="user-1" onCreateWallet={onCreateWallet} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-static')).toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Nova carteira/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onCreateWallet).toHaveBeenCalledTimes(1);
  });

  it('shows "Nova carteira" button inside dropdown (multiple wallets)', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);
    const onCreateWallet = vi.fn();

    render(
      <WalletSelector userId="user-1" onCreateWallet={onCreateWallet} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));

    const btn = screen.getByText('Nova carteira');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onCreateWallet).toHaveBeenCalledTimes(1);
  });

  it('hides "Nova carteira" button when onCreateWallet is not provided', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-static')).toBeInTheDocument();
    });

    expect(screen.queryByText('Nova carteira')).not.toBeInTheDocument();
  });
});

// ── Additional: Loading state ──

describe('Loading state', () => {
  it('shows loading skeleton while fetching wallets', () => {
    mockGetWallets.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<WalletSelector userId="user-1" />);

    expect(screen.getByRole('status', { name: /Carregando carteiras/i })).toBeInTheDocument();
  });
});

// ── Additional: Dropdown keyboard and outside click ──

describe('Dropdown interactions', () => {
  it('closes dropdown on Escape key', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks active wallet with aria-selected', async () => {
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B]);

    render(<WalletSelector userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('wallet-selector-dropdown')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Selecionar carteira/i }));

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });
});
