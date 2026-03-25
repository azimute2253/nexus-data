import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Reusable Confirmation Dialog
// Modal overlay with title, message, and confirm/cancel buttons.
// Used by WalletManagement for destructive actions (delete).
// [Story 12.2]
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
// ---------- Main component ----------
export function ConfirmDialog({ isOpen, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'default', onConfirm, onCancel, }) {
    const confirmRef = useRef(null);
    const overlayRef = useRef(null);
    // ── Focus confirm button when opened ──
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure DOM is ready
            const id = setTimeout(() => confirmRef.current?.focus(), 50);
            return () => clearTimeout(id);
        }
    }, [isOpen]);
    // ── Close on Escape ──
    useEffect(() => {
        if (!isOpen)
            return;
        function handleKeyDown(e) {
            if (e.key === 'Escape')
                onCancel();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);
    // ── Close on backdrop click ──
    const handleBackdropClick = useCallback((e) => {
        if (e.target === overlayRef.current)
            onCancel();
    }, [onCancel]);
    if (!isOpen)
        return null;
    const confirmClasses = variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
        : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';
    return (_jsx("div", { ref: overlayRef, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": title, onClick: handleBackdropClick, "data-testid": "confirm-dialog", children: _jsxs("div", { className: "mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: title }), _jsx("p", { className: "mt-2 text-sm text-gray-600", children: message }), _jsxs("div", { className: "mt-6 flex justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onCancel, className: "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", "data-testid": "confirm-dialog-cancel", children: cancelLabel }), _jsx("button", { ref: confirmRef, type: "button", onClick: onConfirm, className: `rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmClasses}`, "data-testid": "confirm-dialog-confirm", children: confirmLabel })] })] }) }));
}
