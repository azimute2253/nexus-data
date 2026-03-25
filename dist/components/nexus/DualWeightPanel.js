import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Dual Weight Panel Component
// Mode switch (Manual / Questionário) + manual input + questionnaire
// integration via ScoringModal. Displays current weight percentage.
// [Story 14.2, ADR-015]
// ============================================================
import { useState, useCallback } from 'react';
import { ScoringModal } from './ScoringModal.js';
// ---------- Constants ----------
const MANUAL_MIN = -10;
const MANUAL_MAX = 11;
const SCALE_LABELS = {
    [-10]: 'Muito ruim',
    [-5]: 'Ruim',
    [0]: 'Neutro',
    [5]: 'Bom',
    [11]: 'Excelente',
};
// ---------- Scale label helper ----------
function getScaleLabel(value) {
    return SCALE_LABELS[value] ?? null;
}
// ---------- Main component ----------
export function DualWeightPanel({ asset, questionnaire, savedScore, weightPct, onSave, onSaveScore, }) {
    // Local UI state — changes are UI-only until "Salvar"
    const [localMode, setLocalMode] = useState(asset.weight_mode);
    const [localManualWeight, setLocalManualWeight] = useState(String(asset.manual_weight));
    const [validationError, setValidationError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [isScoringOpen, setIsScoringOpen] = useState(false);
    // Validate manual weight input
    const validateManualWeight = useCallback((value) => {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === '-')
            return null;
        const num = Number(trimmed);
        if (Number.isNaN(num))
            return null;
        if (num < MANUAL_MIN || num > MANUAL_MAX)
            return null;
        return num;
    }, []);
    // Handle mode switch (AC5 — UI updates immediately)
    const handleModeChange = useCallback((mode) => {
        setLocalMode(mode);
        setValidationError(null);
        setSaveError(null);
    }, []);
    // Handle manual weight input change
    const handleManualWeightChange = useCallback((e) => {
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
    }, []);
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
            const updates = {
                weight_mode: localMode,
            };
            // Only update manual_weight if in manual mode
            if (localMode === 'manual') {
                updates.manual_weight = Number(localManualWeight);
            }
            // AC8: previous mode data preserved — do NOT clear manual_weight on mode switch
            await onSave(asset.id, updates);
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Erro ao salvar');
            // Rollback optimistic UI
            setLocalMode(asset.weight_mode);
            setLocalManualWeight(String(asset.manual_weight));
        }
        finally {
            setIsSaving(false);
        }
    }, [localMode, localManualWeight, asset, onSave, validateManualWeight]);
    // Resolve the current raw score for display
    const rawScore = localMode === 'manual'
        ? asset.manual_weight
        : (savedScore?.total_score ?? 0);
    return (_jsxs("div", { className: "space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-900", children: "Peso do Ativo" }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: "text-xs text-gray-500", children: "Peso no grupo" }), _jsx("p", { className: "text-lg font-bold tabular-nums text-gray-900", "data-testid": "weight-pct", children: weightPct !== null ? `${weightPct.toFixed(1)}%` : '—' })] })] }), _jsxs("fieldset", { children: [_jsx("legend", { className: "sr-only", children: "Modo de peso" }), _jsxs("div", { className: "flex gap-4", role: "radiogroup", "aria-label": "Modo de peso", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", name: "weight-mode", value: "manual", checked: localMode === 'manual', onChange: () => handleModeChange('manual'), className: "h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Nota manual" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", name: "weight-mode", value: "questionnaire", checked: localMode === 'questionnaire', onChange: () => handleModeChange('questionnaire'), className: "h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Question\u00E1rio" })] })] })] }), localMode === 'manual' && (_jsxs("div", { "data-testid": "manual-input-section", children: [_jsxs("label", { htmlFor: "manual-weight", className: "block text-xs font-medium text-gray-600 mb-1", children: ["Nota (", MANUAL_MIN, " a ", MANUAL_MAX, ")"] }), _jsx("input", { id: "manual-weight", type: "number", min: MANUAL_MIN, max: MANUAL_MAX, step: 1, value: localManualWeight, onChange: handleManualWeightChange, className: `w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationError
                            ? 'border-red-300 text-red-900 focus:ring-red-500'
                            : 'border-gray-300 text-gray-900'}`, "aria-invalid": validationError ? 'true' : 'false', "aria-describedby": validationError ? 'manual-weight-error' : undefined }), !validationError && (() => {
                        const parsed = Number(localManualWeight);
                        if (!Number.isNaN(parsed)) {
                            const label = getScaleLabel(parsed);
                            if (label) {
                                return (_jsx("p", { className: "mt-1 text-xs text-gray-500", children: label }));
                            }
                        }
                        return null;
                    })(), validationError && (_jsx("p", { id: "manual-weight-error", className: "mt-1 text-xs text-red-600", role: "alert", children: validationError }))] })), localMode === 'questionnaire' && (_jsxs("div", { "data-testid": "questionnaire-section", children: [_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "Pontua\u00E7\u00E3o do question\u00E1rio" }), _jsx("p", { className: "text-lg font-bold tabular-nums text-gray-900", "data-testid": "questionnaire-score", children: savedScore?.total_score ?? '—' })] }), _jsx("button", { type: "button", onClick: () => setIsScoringOpen(true), className: "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: savedScore ? 'Editar' : 'Responder' })] }), _jsx(ScoringModal, { isOpen: isScoringOpen, onClose: () => setIsScoringOpen(false), asset: asset, questionnaire: questionnaire, savedScore: savedScore, onSave: onSaveScore })] })), _jsxs("div", { className: "flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2", children: [_jsx("span", { className: "text-xs text-gray-500", children: "Nota bruta" }), _jsx("span", { className: "text-sm font-semibold tabular-nums text-gray-900", "data-testid": "raw-score", children: rawScore })] }), saveError && (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 p-3 text-center", role: "alert", children: _jsx("p", { className: "text-sm text-red-700", children: saveError }) })), _jsx("button", { type: "button", onClick: handleSave, disabled: isSaving || (localMode === 'manual' && validationError !== null), className: "w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500", children: isSaving ? 'Salvando...' : 'Salvar' })] }));
}
