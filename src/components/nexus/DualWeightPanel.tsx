// ============================================================
// Nexus Data — Dual Weight Panel Component
// Mode switch (Manual / Questionário) + manual input + questionnaire
// integration via ScoringModal. Displays current weight percentage.
// [Story 14.2, ADR-015]
// ============================================================

import { useState, useCallback } from 'react';
import type {
  Asset,
  AssetUpdate,
  WeightMode,
  Questionnaire,
  AssetScore,
  ScoreAnswer,
} from '../../lib/nexus/types.js';
import { ScoringModal } from './ScoringModal.js';

// ---------- Constants ----------

const MANUAL_MIN = -10;
const MANUAL_MAX = 11;

const SCALE_LABELS: Record<number, string> = {
  [-10]: 'Muito ruim',
  [-5]: 'Ruim',
  [0]: 'Neutro',
  [5]: 'Bom',
  [11]: 'Excelente',
};

// ---------- Props ----------

export interface DualWeightPanelProps {
  /** The asset being edited */
  asset: Asset;
  /** Questionnaire linked to the asset's type (null = no questionnaire) */
  questionnaire: Questionnaire | null;
  /** Previously saved questionnaire score (null = fresh) */
  savedScore: AssetScore | null;
  /** Normalized weight percentage within the group (0-100, read-only) */
  weightPct: number | null;
  /** Callback to persist asset updates (weight_mode + manual_weight) */
  onSave: (id: string, updates: AssetUpdate) => Promise<void>;
  /** Callback to persist questionnaire answers */
  onSaveScore: (answers: ScoreAnswer[]) => Promise<void>;
}

// ---------- Scale label helper ----------

function getScaleLabel(value: number): string | null {
  return SCALE_LABELS[value] ?? null;
}

// ---------- Main component ----------

export function DualWeightPanel({
  asset,
  questionnaire,
  savedScore,
  weightPct,
  onSave,
  onSaveScore,
}: DualWeightPanelProps) {
  // Local UI state — changes are UI-only until "Salvar"
  const [localMode, setLocalMode] = useState<WeightMode>(asset.weight_mode);
  const [localManualWeight, setLocalManualWeight] = useState<string>(
    String(asset.manual_weight),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isScoringOpen, setIsScoringOpen] = useState(false);

  // Validate manual weight input
  const validateManualWeight = useCallback((value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '-') return null;

    const num = Number(trimmed);
    if (Number.isNaN(num)) return null;

    if (num < MANUAL_MIN || num > MANUAL_MAX) return null;

    return num;
  }, []);

  // Handle mode switch (AC5 — UI updates immediately)
  const handleModeChange = useCallback((mode: WeightMode) => {
    setLocalMode(mode);
    setValidationError(null);
    setSaveError(null);
  }, []);

  // Handle manual weight input change
  const handleManualWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalManualWeight(raw);

      // Clear save error on edit
      setSaveError(null);

      // Validate
      const trimmed = raw.trim();
      if (trimmed === '' || trimmed === '-') {
        setValidationError(null);
        return;
      }

      const num = Number(trimmed);
      if (Number.isNaN(num)) {
        setValidationError('Valor inválido');
        return;
      }

      if (num < MANUAL_MIN || num > MANUAL_MAX) {
        setValidationError(`Valor deve estar entre ${MANUAL_MIN} e ${MANUAL_MAX}`);
        return;
      }

      setValidationError(null);
    },
    [],
  );

  // Handle save (AC6 — persist weight_mode + value)
  const handleSave = useCallback(async () => {
    if (localMode === 'manual') {
      const parsed = validateManualWeight(localManualWeight);
      if (parsed === null) {
        setValidationError(`Valor deve estar entre ${MANUAL_MIN} e ${MANUAL_MAX}`);
        return;
      }
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const updates: AssetUpdate = {
        weight_mode: localMode,
      };

      // Only update manual_weight if in manual mode
      if (localMode === 'manual') {
        updates.manual_weight = Number(localManualWeight);
      }
      // AC8: previous mode data preserved — do NOT clear manual_weight on mode switch

      await onSave(asset.id, updates);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
      // Rollback optimistic UI
      setLocalMode(asset.weight_mode);
      setLocalManualWeight(String(asset.manual_weight));
    } finally {
      setIsSaving(false);
    }
  }, [localMode, localManualWeight, asset, onSave, validateManualWeight]);

  // Resolve the current raw score for display
  const rawScore =
    localMode === 'manual'
      ? asset.manual_weight
      : (savedScore?.total_score ?? 0);

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Peso do Ativo</h3>
        {/* AC7: Always display current weight percentage */}
        <div className="text-right">
          <span className="text-xs text-gray-500">Peso no grupo</span>
          <p className="text-lg font-bold tabular-nums text-gray-900" data-testid="weight-pct">
            {weightPct !== null ? `${weightPct.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* AC1: Mode switch (radio buttons) */}
      <fieldset>
        <legend className="sr-only">Modo de peso</legend>
        <div className="flex gap-4" role="radiogroup" aria-label="Modo de peso">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="weight-mode"
              value="manual"
              checked={localMode === 'manual'}
              onChange={() => handleModeChange('manual')}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Nota manual</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="weight-mode"
              value="questionnaire"
              checked={localMode === 'questionnaire'}
              onChange={() => handleModeChange('questionnaire')}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Questionário</span>
          </label>
        </div>
      </fieldset>

      {/* AC2: Manual mode — numeric input */}
      {localMode === 'manual' && (
        <div data-testid="manual-input-section">
          <label htmlFor="manual-weight" className="block text-xs font-medium text-gray-600 mb-1">
            Nota ({MANUAL_MIN} a {MANUAL_MAX})
          </label>
          <input
            id="manual-weight"
            type="number"
            min={MANUAL_MIN}
            max={MANUAL_MAX}
            step={1}
            value={localManualWeight}
            onChange={handleManualWeightChange}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              validationError
                ? 'border-red-300 text-red-900 focus:ring-red-500'
                : 'border-gray-300 text-gray-900'
            }`}
            aria-invalid={validationError ? 'true' : 'false'}
            aria-describedby={validationError ? 'manual-weight-error' : undefined}
          />
          {/* Scale label hint */}
          {!validationError && (() => {
            const parsed = Number(localManualWeight);
            if (!Number.isNaN(parsed)) {
              const label = getScaleLabel(parsed);
              if (label) {
                return (
                  <p className="mt-1 text-xs text-gray-500">{label}</p>
                );
              }
            }
            return null;
          })()}
          {/* AC4: Validation error */}
          {validationError && (
            <p
              id="manual-weight-error"
              className="mt-1 text-xs text-red-600"
              role="alert"
            >
              {validationError}
            </p>
          )}
        </div>
      )}

      {/* AC3: Questionnaire mode — ScoringModal access */}
      {localMode === 'questionnaire' && (
        <div data-testid="questionnaire-section">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <div>
              <p className="text-xs text-gray-500">Pontuação do questionário</p>
              <p className="text-lg font-bold tabular-nums text-gray-900" data-testid="questionnaire-score">
                {savedScore?.total_score ?? '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsScoringOpen(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {savedScore ? 'Editar' : 'Responder'}
            </button>
          </div>
          <ScoringModal
            isOpen={isScoringOpen}
            onClose={() => setIsScoringOpen(false)}
            asset={asset}
            questionnaire={questionnaire}
            savedScore={savedScore}
            onSave={onSaveScore}
          />
        </div>
      )}

      {/* Raw score display */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-500">Nota bruta</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900" data-testid="raw-score">
          {rawScore}
        </span>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center" role="alert">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      {/* AC6: Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || (localMode === 'manual' && validationError !== null)}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSaving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
