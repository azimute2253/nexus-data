import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Wallet Management Component
// Create, rename, and delete wallets. Delete requires confirmation
// dialog with cascade warning. After delete, switches to most
// recent remaining wallet (or onboarding if none left).
// [Story 12.2, ADR-010, ADR-012]
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { createWallet, updateWallet, deleteWallet, getWallets } from '../../lib/nexus/wallets.js';
import { ConfirmDialog } from './ConfirmDialog.js';
// ---------- Constants ----------
const NAME_MIN = 1;
const NAME_MAX = 50;
const CASCADE_WARNING = 'Ao excluir esta carteira, todos os dados associados (classes, grupos, ativos, questionários) serão removidos permanentemente.';
// ---------- SVG Icons ----------
function IconX({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }));
}
function IconPencil({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }), _jsx("path", { d: "m15 5 4 4" })] }));
}
function IconTrash({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }), _jsx("path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" })] }));
}
// ---------- Validation ----------
function validateName(name) {
    const trimmed = name.trim();
    if (trimmed.length < NAME_MIN)
        return 'Nome da carteira é obrigatório';
    if (name.length > NAME_MAX)
        return `Nome deve ter no máximo ${NAME_MAX} caracteres`;
    return null;
}
function CreateModal({ isOpen, isSubmitting, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => {
        if (isOpen) {
            setName('');
            setError(null);
            const id = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(id);
        }
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        function handleKeyDown(e) {
            if (e.key === 'Escape')
                onClose();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    const handleSubmit = useCallback(() => {
        const validationError = validateName(name);
        if (validationError) {
            setError(validationError);
            return;
        }
        onSubmit(name.trim());
    }, [name, onSubmit]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": "Nova carteira", onClick: (e) => { if (e.target === e.currentTarget)
            onClose(); }, "data-testid": "create-wallet-modal", children: _jsxs("div", { className: "mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Nova carteira" }), _jsx("button", { type: "button", onClick: onClose, className: "rounded-md p-1 text-gray-400 hover:text-gray-600", "aria-label": "Fechar", children: _jsx(IconX, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "mt-4", children: [_jsx("label", { htmlFor: "wallet-name-input", className: "block text-sm font-medium text-gray-700", children: "Nome da carteira" }), _jsx("input", { ref: inputRef, id: "wallet-name-input", type: "text", value: name, onChange: (e) => {
                                setName(e.target.value);
                                if (error)
                                    setError(null);
                            }, onKeyDown: handleKeyDown, maxLength: NAME_MAX, placeholder: "Ex: Carteira de A\u00E7\u00F5es", className: `mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${error
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`, "data-testid": "create-wallet-input" }), error && (_jsx("p", { className: "mt-1 text-sm text-red-600", role: "alert", "data-testid": "create-wallet-error", children: error })), _jsxs("p", { className: "mt-1 text-xs text-gray-400", children: [name.length, "/", NAME_MAX] })] }), _jsxs("div", { className: "mt-6 flex justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onClose, disabled: isSubmitting, className: "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Cancelar" }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: isSubmitting, className: "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50", "data-testid": "create-wallet-submit", children: isSubmitting ? 'Criando...' : 'Criar' })] })] }) }));
}
function RenameModal({ isOpen, isSubmitting, currentName, onClose, onSubmit }) {
    const [name, setName] = useState(currentName);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => {
        if (isOpen) {
            setName(currentName);
            setError(null);
            const id = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
            return () => clearTimeout(id);
        }
    }, [isOpen, currentName]);
    useEffect(() => {
        if (!isOpen)
            return;
        function handleKeyDown(e) {
            if (e.key === 'Escape')
                onClose();
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    const handleSubmit = useCallback(() => {
        const validationError = validateName(name);
        if (validationError) {
            setError(validationError);
            return;
        }
        onSubmit(name.trim());
    }, [name, onSubmit]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": "Renomear carteira", onClick: (e) => { if (e.target === e.currentTarget)
            onClose(); }, "data-testid": "rename-wallet-modal", children: _jsxs("div", { className: "mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900", children: "Renomear carteira" }), _jsx("button", { type: "button", onClick: onClose, className: "rounded-md p-1 text-gray-400 hover:text-gray-600", "aria-label": "Fechar", children: _jsx(IconX, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "mt-4", children: [_jsx("label", { htmlFor: "rename-wallet-input", className: "block text-sm font-medium text-gray-700", children: "Novo nome" }), _jsx("input", { ref: inputRef, id: "rename-wallet-input", type: "text", value: name, onChange: (e) => {
                                setName(e.target.value);
                                if (error)
                                    setError(null);
                            }, onKeyDown: handleKeyDown, maxLength: NAME_MAX, className: `mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${error
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`, "data-testid": "rename-wallet-input" }), error && (_jsx("p", { className: "mt-1 text-sm text-red-600", role: "alert", "data-testid": "rename-wallet-error", children: error })), _jsxs("p", { className: "mt-1 text-xs text-gray-400", children: [name.length, "/", NAME_MAX] })] }), _jsxs("div", { className: "mt-6 flex justify-end gap-3", children: [_jsx("button", { type: "button", onClick: onClose, disabled: isSubmitting, className: "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", children: "Cancelar" }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: isSubmitting, className: "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50", "data-testid": "rename-wallet-submit", children: isSubmitting ? 'Salvando...' : 'Salvar' })] })] }) }));
}
// ---------- Main component ----------
export function WalletManagement({ userId, activeWallet, wallets, onWalletsChange, }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [walletToDelete, setWalletToDelete] = useState(null);
    const [walletToRename, setWalletToRename] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // ── Create wallet ──
    const handleCreate = useCallback(async (name) => {
        setIsSubmitting(true);
        try {
            const input = { user_id: userId, name };
            const created = await createWallet(input);
            const updated = await getWallets(userId);
            setShowCreateModal(false);
            onWalletsChange(updated, created);
        }
        catch (err) {
            console.error("[WalletManagement] error:", err);
            // Error handled by caller or UI layer
        }
        finally {
            setIsSubmitting(false);
        }
    }, [userId, onWalletsChange]);
    // ── Rename wallet ──
    const handleRename = useCallback(async (name) => {
        if (!walletToRename)
            return;
        setIsSubmitting(true);
        try {
            const renamed = await updateWallet(walletToRename.id, { name });
            const updated = await getWallets(userId);
            setShowRenameModal(false);
            setWalletToRename(null);
            // Keep active wallet, but with updated data
            const newActive = activeWallet?.id === renamed.id ? renamed : activeWallet;
            onWalletsChange(updated, newActive);
        }
        catch (err) {
            console.error("[WalletManagement] error:", err);
            // Error handled by caller or UI layer
        }
        finally {
            setIsSubmitting(false);
        }
    }, [userId, activeWallet, walletToRename, onWalletsChange]);
    // ── Delete wallet ──
    const handleDeleteConfirm = useCallback(async () => {
        if (!walletToDelete)
            return;
        setIsSubmitting(true);
        try {
            await deleteWallet(walletToDelete.id);
            const updated = await getWallets(userId);
            setWalletToDelete(null);
            if (updated.length === 0) {
                // No wallets left → onboarding
                onWalletsChange([], null);
            }
            else {
                // Switch to most recently created wallet
                const mostRecent = updated[updated.length - 1];
                onWalletsChange(updated, mostRecent);
            }
        }
        catch (err) {
            console.error("[WalletManagement] error:", err);
            // Error handled by caller or UI layer
        }
        finally {
            setIsSubmitting(false);
        }
    }, [userId, walletToDelete, onWalletsChange]);
    // ── Open rename ──
    const openRename = useCallback((wallet) => {
        setWalletToRename(wallet);
        setShowRenameModal(true);
    }, []);
    // ── Open delete ──
    const openDelete = useCallback((wallet) => {
        setWalletToDelete(wallet);
    }, []);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { "data-testid": "wallet-management", className: "space-y-2", children: [wallets.map((wallet) => (_jsxs("div", { className: `flex items-center justify-between rounded-md border px-3 py-2 ${activeWallet?.id === wallet.id
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-white'}`, "data-testid": `wallet-item-${wallet.id}`, children: [_jsx("span", { className: "truncate text-sm font-medium text-gray-900", children: wallet.name }), _jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [_jsx("button", { type: "button", onClick: () => openRename(wallet), className: "rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600", "aria-label": `Renomear ${wallet.name}`, "data-testid": `rename-wallet-${wallet.id}`, children: _jsx(IconPencil, { className: "h-4 w-4" }) }), _jsx("button", { type: "button", onClick: () => openDelete(wallet), className: "rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600", "aria-label": `Excluir ${wallet.name}`, "data-testid": `delete-wallet-${wallet.id}`, children: _jsx(IconTrash, { className: "h-4 w-4" }) })] })] }, wallet.id))), _jsx("button", { type: "button", onClick: () => setShowCreateModal(true), className: "mt-2 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", "data-testid": "create-wallet-button", children: "Nova carteira" })] }), _jsx(CreateModal, { isOpen: showCreateModal, isSubmitting: isSubmitting, onClose: () => setShowCreateModal(false), onSubmit: handleCreate }), _jsx(RenameModal, { isOpen: showRenameModal, isSubmitting: isSubmitting, currentName: walletToRename?.name ?? '', onClose: () => {
                    setShowRenameModal(false);
                    setWalletToRename(null);
                }, onSubmit: handleRename }), _jsx(ConfirmDialog, { isOpen: walletToDelete !== null, title: "Excluir carteira", message: CASCADE_WARNING, confirmLabel: "Excluir", cancelLabel: "Cancelar", variant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setWalletToDelete(null) })] }));
}
