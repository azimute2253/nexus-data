// @vitest-environment jsdom
// ============================================================
// Tests for WalletManagement + ConfirmDialog (Story 12.2)
// T12.2.1–T12.2.6: Create, validation, rename, delete confirm/cancel, last wallet
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WalletManagement } from '../../src/components/nexus/WalletManagement.js';
import { ConfirmDialog } from '../../src/components/nexus/ConfirmDialog.js';
import type { Wallet } from '../../src/lib/nexus/types.js';

// ── Mock wallet CRUD ────────────────────────────────────────

const mockCreateWallet = vi.fn();
const mockUpdateWallet = vi.fn();
const mockDeleteWallet = vi.fn();
const mockGetWallets = vi.fn();

vi.mock('../../src/lib/nexus/wallets.js', () => ({
  createWallet: (...args: unknown[]) => mockCreateWallet(...args),
  updateWallet: (...args: unknown[]) => mockUpdateWallet(...args),
  deleteWallet: (...args: unknown[]) => mockDeleteWallet(...args),
  getWallets: (...args: unknown[]) => mockGetWallets(...args),
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

const WALLET_CRYPTO: Wallet = {
  id: 'wallet-crypto',
  user_id: 'user-1',
  name: 'Crypto',
  created_at: '2026-03-01T00:00:00Z',
};

// ── Setup/Teardown ───────────────────────────────────────────

beforeEach(() => {
  mockCreateWallet.mockReset();
  mockUpdateWallet.mockReset();
  mockDeleteWallet.mockReset();
  mockGetWallets.mockReset();
});

afterEach(() => {
  cleanup();
});

// ── T12.2.1 — Create wallet "Crypto" → wallet created + becomes active ──

describe('T12.2.1 — Create wallet', () => {
  it('creates wallet "Crypto" and it becomes active', async () => {
    const onWalletsChange = vi.fn();
    mockCreateWallet.mockResolvedValue(WALLET_CRYPTO);
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_B, WALLET_CRYPTO]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={onWalletsChange}
      />,
    );

    // Click "Nova carteira" button
    fireEvent.click(screen.getByTestId('create-wallet-button'));

    // Modal should appear
    expect(screen.getByTestId('create-wallet-modal')).toBeInTheDocument();

    // Type wallet name
    const input = screen.getByTestId('create-wallet-input');
    fireEvent.change(input, { target: { value: 'Crypto' } });

    // Click "Criar"
    fireEvent.click(screen.getByTestId('create-wallet-submit'));

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Crypto',
      });
    });

    await waitFor(() => {
      // onWalletsChange called with updated list and new wallet as active
      expect(onWalletsChange).toHaveBeenCalledWith(
        [WALLET_A, WALLET_B, WALLET_CRYPTO],
        WALLET_CRYPTO,
      );
    });
  });

  it('closes modal after successful creation', async () => {
    mockCreateWallet.mockResolvedValue(WALLET_CRYPTO);
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_CRYPTO]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-wallet-button'));
    expect(screen.getByTestId('create-wallet-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('create-wallet-input'), {
      target: { value: 'Crypto' },
    });
    fireEvent.click(screen.getByTestId('create-wallet-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('create-wallet-modal')).not.toBeInTheDocument();
    });
  });
});

// ── T12.2.2 — Create wallet with empty name → validation error ──

describe('T12.2.2 — Create wallet validation', () => {
  it('shows error when attempting to create with empty name', () => {
    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-wallet-button'));

    // Try to submit with empty name
    fireEvent.click(screen.getByTestId('create-wallet-submit'));

    expect(screen.getByTestId('create-wallet-error')).toHaveTextContent(
      'Nome da carteira é obrigatório',
    );

    // Should NOT call createWallet
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  it('shows error when name is only whitespace', () => {
    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-wallet-button'));

    fireEvent.change(screen.getByTestId('create-wallet-input'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByTestId('create-wallet-submit'));

    expect(screen.getByTestId('create-wallet-error')).toBeInTheDocument();
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });
});

// ── T12.2.3 — Rename wallet to "New Name" → name updated ──

describe('T12.2.3 — Rename wallet', () => {
  it('renames wallet and updates list', async () => {
    const onWalletsChange = vi.fn();
    const renamedWallet = { ...WALLET_A, name: 'New Name' };
    mockUpdateWallet.mockResolvedValue(renamedWallet);
    mockGetWallets.mockResolvedValue([renamedWallet, WALLET_B]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={onWalletsChange}
      />,
    );

    // Click rename button for wallet A
    fireEvent.click(screen.getByTestId(`rename-wallet-${WALLET_A.id}`));

    // Rename modal should appear
    expect(screen.getByTestId('rename-wallet-modal')).toBeInTheDocument();

    // Change name
    const input = screen.getByTestId('rename-wallet-input');
    fireEvent.change(input, { target: { value: 'New Name' } });

    // Submit
    fireEvent.click(screen.getByTestId('rename-wallet-submit'));

    await waitFor(() => {
      expect(mockUpdateWallet).toHaveBeenCalledWith(WALLET_A.id, { name: 'New Name' });
    });

    await waitFor(() => {
      expect(onWalletsChange).toHaveBeenCalledWith(
        [renamedWallet, WALLET_B],
        renamedWallet,
      );
    });
  });
});

// ── T12.2.4 — Delete wallet (confirm) → wallet + data removed ──

describe('T12.2.4 — Delete wallet (confirm)', () => {
  it('deletes wallet after confirmation and switches to most recent', async () => {
    const onWalletsChange = vi.fn();
    mockDeleteWallet.mockResolvedValue(undefined);
    mockGetWallets.mockResolvedValue([WALLET_A]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_B}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={onWalletsChange}
      />,
    );

    // Click delete button for wallet B
    fireEvent.click(screen.getByTestId(`delete-wallet-${WALLET_B.id}`));

    // Confirmation dialog should appear with cascade warning
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/todos os dados associados/)).toBeInTheDocument();

    // Confirm delete
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(mockDeleteWallet).toHaveBeenCalledWith(WALLET_B.id);
    });

    await waitFor(() => {
      // Should switch to remaining wallet (most recent = last in array)
      expect(onWalletsChange).toHaveBeenCalledWith([WALLET_A], WALLET_A);
    });
  });
});

// ── T12.2.5 — Delete wallet (cancel) → nothing happens ──

describe('T12.2.5 — Delete wallet (cancel)', () => {
  it('cancels delete and wallet remains', () => {
    const onWalletsChange = vi.fn();

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={onWalletsChange}
      />,
    );

    // Click delete button
    fireEvent.click(screen.getByTestId(`delete-wallet-${WALLET_A.id}`));

    // Confirmation dialog visible
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));

    // Dialog should close
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    // No delete call
    expect(mockDeleteWallet).not.toHaveBeenCalled();

    // No wallets change
    expect(onWalletsChange).not.toHaveBeenCalled();
  });
});

// ── T12.2.6 — Delete last wallet → onboarding flow triggers ──

describe('T12.2.6 — Delete last wallet', () => {
  it('deleting the only wallet triggers onboarding (null active)', async () => {
    const onWalletsChange = vi.fn();
    mockDeleteWallet.mockResolvedValue(undefined);
    mockGetWallets.mockResolvedValue([]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={onWalletsChange}
      />,
    );

    // Click delete on the only wallet
    fireEvent.click(screen.getByTestId(`delete-wallet-${WALLET_A.id}`));

    // Confirm
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(mockDeleteWallet).toHaveBeenCalledWith(WALLET_A.id);
    });

    await waitFor(() => {
      // Empty wallets + null active → triggers onboarding
      expect(onWalletsChange).toHaveBeenCalledWith([], null);
    });
  });
});

// ── ConfirmDialog unit tests ──

describe('ConfirmDialog', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Test"
        message="Test message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses custom button labels', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Test"
        message="Test"
        confirmLabel="Excluir"
        cancelLabel="Voltar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Excluir');
    expect(screen.getByTestId('confirm-dialog-cancel')).toHaveTextContent('Voltar');
  });
});

// ── Additional: Wallet Management rendering ──

describe('WalletManagement rendering', () => {
  it('renders all wallets with rename and delete buttons', () => {
    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('wallet-management')).toBeInTheDocument();
    expect(screen.getByText('Carteira Principal')).toBeInTheDocument();
    expect(screen.getByText('Reserva de Emergência')).toBeInTheDocument();

    // Rename and delete buttons for each wallet
    expect(screen.getByTestId(`rename-wallet-${WALLET_A.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`delete-wallet-${WALLET_A.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`rename-wallet-${WALLET_B.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`delete-wallet-${WALLET_B.id}`)).toBeInTheDocument();
  });

  it('highlights active wallet', () => {
    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A, WALLET_B]}
        onWalletsChange={vi.fn()}
      />,
    );

    const activeItem = screen.getByTestId(`wallet-item-${WALLET_A.id}`);
    expect(activeItem.className).toContain('bg-blue-50');

    const inactiveItem = screen.getByTestId(`wallet-item-${WALLET_B.id}`);
    expect(inactiveItem.className).not.toContain('bg-blue-50');
  });

  it('shows "Nova carteira" button', () => {
    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('create-wallet-button')).toHaveTextContent('Nova carteira');
  });
});

// ── Additional: Create modal Enter key ──

describe('Create modal keyboard', () => {
  it('submits on Enter key', async () => {
    mockCreateWallet.mockResolvedValue(WALLET_CRYPTO);
    mockGetWallets.mockResolvedValue([WALLET_A, WALLET_CRYPTO]);

    render(
      <WalletManagement
        userId="user-1"
        activeWallet={WALLET_A}
        wallets={[WALLET_A]}
        onWalletsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-wallet-button'));
    const input = screen.getByTestId('create-wallet-input');
    fireEvent.change(input, { target: { value: 'Crypto' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Crypto',
      });
    });
  });
});
