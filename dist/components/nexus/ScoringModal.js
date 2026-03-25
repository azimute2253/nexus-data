import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Scoring Modal Component
// Modal overlay for scoring an asset using Sim/Nao questionnaire.
// Loads questions from the linked questionnaire, lets user answer
// each with radio buttons, calculates score via data layer, and
// displays the result. Supports pre-filling saved answers.
// [Story 7.2, ADR-004, ADR-006]
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react';
import { calculateScore } from '../../lib/nexus/asset-scores.js';
// ---------- Close (X) icon ----------
function CloseIcon() {
    return (_jsx("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" }) }));
}
// ---------- Progress bar ----------
function ProgressBar({ answered, total }) {
    const pct = total > 0 ? (answered / total) * 100 : 0;
    return (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-gray-500", children: [_jsxs("span", { children: [answered, " de ", total, " respondidas"] }), _jsxs("span", { children: [Math.round(pct), "%"] })] }), _jsx("div", { className: "h-2 w-full overflow-hidden rounded-full bg-gray-200", role: "progressbar", "aria-valuenow": answered, "aria-valuemin": 0, "aria-valuemax": total, children: _jsx("div", { className: "h-full rounded-full bg-blue-600 transition-all duration-300", style: { width: `${pct}%` } }) })] }));
}
// ---------- Question row ----------
function QuestionRow({ question, value, onChange, index, }) {
    const name = `q-${question.id}`;
    return (_jsxs("div", { className: "flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("span", { className: "text-xs font-medium text-gray-400 mr-2", children: [index + 1, "."] }), _jsx("span", { className: "text-sm text-gray-900", children: question.text }), question.weight === -1 && (_jsx("span", { className: "ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700", children: "peso -1" }))] }), _jsxs("div", { className: "flex items-center gap-4 shrink-0", role: "radiogroup", "aria-label": `Resposta para pergunta ${index + 1}`, children: [_jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "radio", name: name, checked: value === true, onChange: () => onChange(question.id, true), className: "h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm font-medium text-green-700", children: "Sim" })] }), _jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "radio", name: name, checked: value === false, onChange: () => onChange(question.id, false), className: "h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm font-medium text-red-700", children: "Nao" })] })] })] }));
}
// ---------- Score display ----------
function ScoreDisplay({ score }) {
    const color = score > 0 ? 'text-green-700' : score < 0 ? 'text-red-700' : 'text-gray-700';
    return (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "Pontuacao" }), _jsx("span", { className: `text-2xl font-bold tabular-nums ${color}`, children: score })] }));
}
// ---------- Main component ----------
export function ScoringModal({ isOpen, onClose, asset, questionnaire, savedScore, onSave, }) {
    // Map of question_id → boolean | null (null = unanswered)
    const [answers, setAnswers] = useState(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [showResult, setShowResult] = useState(false);
    // Initialize answers when modal opens or savedScore changes
    useEffect(() => {
        if (!isOpen || !questionnaire)
            return;
        const initial = new Map();
        const savedMap = new Map((savedScore?.answers ?? []).map((a) => [a.question_id, a.value]));
        for (const q of questionnaire.questions) {
            initial.set(q.id, savedMap.get(q.id) ?? null);
        }
        setAnswers(initial);
        setSaveError(null);
        setShowResult(false);
    }, [isOpen, questionnaire, savedScore]);
    const sortedQuestions = useMemo(() => {
        if (!questionnaire)
            return [];
        return [...questionnaire.questions].sort((a, b) => a.sort_order - b.sort_order);
    }, [questionnaire]);
    const answeredCount = useMemo(() => {
        let count = 0;
        for (const v of answers.values()) {
            if (v !== null)
                count++;
        }
        return count;
    }, [answers]);
    const allAnswered = answeredCount === sortedQuestions.length && sortedQuestions.length > 0;
    const liveScore = useMemo(() => {
        if (!questionnaire)
            return 0;
        const answered = [];
        for (const [qId, val] of answers) {
            if (val !== null) {
                answered.push({ question_id: qId, value: val });
            }
        }
        if (answered.length === 0)
            return 0;
        try {
            // Only calculate with answered questions — filter questions to match
            const answeredIds = new Set(answered.map((a) => a.question_id));
            const matchingQuestions = questionnaire.questions.filter((q) => answeredIds.has(q.id));
            return calculateScore(answered, matchingQuestions);
        }
        catch {
            return 0;
        }
    }, [answers, questionnaire]);
    const handleAnswer = useCallback((questionId, value) => {
        setAnswers((prev) => {
            const next = new Map(prev);
            next.set(questionId, value);
            return next;
        });
        setShowResult(false);
    }, []);
    const handleSave = useCallback(async () => {
        if (!allAnswered)
            return;
        const scoreAnswers = [];
        for (const [qId, val] of answers) {
            if (val !== null) {
                scoreAnswers.push({ question_id: qId, value: val });
            }
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(scoreAnswers);
            setShowResult(true);
        }
        catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Erro ao salvar pontuacao');
        }
        finally {
            setIsSaving(false);
        }
    }, [allAnswered, answers, onSave]);
    // Close handler — discard unsaved state (AC7)
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);
    // Trap focus: close on Escape
    useEffect(() => {
        if (!isOpen)
            return;
        function onKeyDown(e) {
            if (e.key === 'Escape') {
                handleClose();
            }
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, handleClose]);
    if (!isOpen)
        return null;
    // No questionnaire linked (AC8 — error state)
    if (!questionnaire) {
        return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": `Pontuar ${asset.ticker}`, children: _jsxs("div", { className: "mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900", children: ["Pontuar ", asset.ticker] }), _jsx("button", { type: "button", onClick: handleClose, className: "rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors", "aria-label": "Fechar", children: _jsx(CloseIcon, {}) })] }), _jsx("div", { className: "rounded-lg border border-amber-200 bg-amber-50 p-4 text-center", role: "alert", children: _jsx("p", { className: "text-sm text-amber-800", children: "Nenhum questionario vinculado a este tipo de ativo" }) }), _jsx("div", { className: "mt-4 flex justify-end", children: _jsx("button", { type: "button", onClick: handleClose, className: "rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors", children: "Fechar" }) })] }) }));
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": `Pontuar ${asset.ticker}`, children: _jsxs("div", { className: "mx-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900", children: ["Pontuar ", asset.ticker] }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: questionnaire.name })] }), _jsx("button", { type: "button", onClick: handleClose, className: "rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors", "aria-label": "Fechar", children: _jsx(CloseIcon, {}) })] }), _jsx("div", { className: "px-6 pt-4 shrink-0", children: _jsx(ProgressBar, { answered: answeredCount, total: sortedQuestions.length }) }), _jsx("div", { className: "px-6 pt-3 shrink-0", children: _jsx(ScoreDisplay, { score: liveScore }) }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4 space-y-3", children: sortedQuestions.map((q, i) => (_jsx(QuestionRow, { question: q, value: answers.get(q.id) ?? null, onChange: handleAnswer, index: i }, q.id))) }), saveError && (_jsx("div", { className: "px-6 shrink-0", children: _jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 p-3 text-center", role: "alert", children: _jsx("p", { className: "text-sm text-red-700", children: saveError }) }) })), showResult && (_jsx("div", { className: "px-6 shrink-0", children: _jsx("div", { className: "rounded-lg border border-green-200 bg-green-50 p-3 text-center", children: _jsx("p", { className: "text-sm text-green-700", children: "Pontuacao salva com sucesso!" }) }) })), _jsxs("div", { className: "flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 shrink-0", children: [_jsx("button", { type: "button", onClick: handleClose, className: "rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors", children: "Cancelar" }), _jsx("button", { type: "button", onClick: handleSave, disabled: !allAnswered || isSaving, className: "rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500", children: isSaving ? 'Salvando...' : 'Salvar' })] })] }) }));
}
