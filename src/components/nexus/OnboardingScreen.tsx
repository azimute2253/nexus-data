// ============================================================
// Nexus Data — Onboarding Screen Component
// Welcome screen for users with 0 wallets.
// Shows welcome message, explanation text, wallet name input,
// and "Criar minha carteira" button.
// After creation: saves wallet_id to localStorage, reloads page.
// [Story 12.3, ADR-016, ADR-012]
// ============================================================

import { useState, useCallback } from 'react';
import { createWallet } from '../../lib/nexus/wallets.js';

// ---------- Constants ----------

import { NEXUS_ACTIVE_WALLET_KEY as STORAGE_KEY } from '../../lib/nexus/constants';
const MAX_NAME_LENGTH = 50;

// ---------- localStorage helper ----------

function writeStoredWalletId(walletId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, walletId);
  } catch {
    // Silently ignore (private browsing, full storage, etc.)
  }
}

// ---------- Props ----------

export interface OnboardingScreenProps {
  /** Authenticated user ID */
  userId: string;
}

// ---------- Main component ----------

export function OnboardingScreen({ userId }: OnboardingScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 1 && trimmedName.length <= MAX_NAME_LENGTH;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!isValid) {
        setError(
          trimmedName.length === 0
            ? 'O nome da carteira é obrigatório.'
            : `O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`,
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const wallet = await createWallet({ user_id: userId, name: trimmedName });
        writeStoredWalletId(wallet.id);
        window.location.reload();
      } catch {
        setError('Erro ao criar carteira. Tente novamente.');
        setIsSubmitting(false);
      }
    },
    [userId, trimmedName, isValid],
  );

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      data-testid="onboarding-screen"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        {/* Welcome heading */}
        <h1 className="text-center text-2xl font-bold text-gray-900 md:text-3xl">
          Bem-vindo ao Nexus Data
        </h1>

        {/* Explanation text */}
        <p className="mt-3 text-center text-sm text-gray-600 md:text-base">
          Organize seus investimentos, acompanhe a alocação e faça rebalanceamentos
          inteligentes. Comece criando sua primeira carteira.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="wallet-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nome da carteira
            </label>
            <input
              id="wallet-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: Minha Carteira"
              maxLength={MAX_NAME_LENGTH}
              disabled={isSubmitting}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              } disabled:cursor-not-allowed disabled:bg-gray-50`}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'wallet-name-error' : undefined}
            />
            {error && (
              <p
                id="wallet-name-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Criando...' : 'Criar minha carteira'}
          </button>
        </form>
      </div>
    </div>
  );
}
