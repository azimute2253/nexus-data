import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Asset Tree Node Component
// Individual tree node with inline CRUD for class, group, or asset.
// Handles create/edit forms and delete confirmation inline.
// [Story 15.3]
// ============================================================
import { useState, useCallback } from 'react';
// ---------- Price source options ----------
const PRICE_SOURCES = [
    { value: 'brapi', label: 'BRAPI' },
    { value: 'yahoo', label: 'Yahoo' },
    { value: 'manual', label: 'Manual' },
    { value: 'crypto', label: 'Crypto' },
    { value: 'exchange', label: 'Exchange' },
];
// ---------- Shared inline form row ----------
function FormRow({ children }) {
    return _jsx("div", { className: "flex flex-wrap items-end gap-2", children: children });
}
function FormField({ label, children, className = '', }) {
    return (_jsxs("label", { className: `block text-xs ${className}`, children: [_jsx("span", { className: "text-gray-600", children: label }), children] }));
}
const INPUT_BASE = 'mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
export function ClassNode({ assetType, isExpanded, onToggle, onUpdate, onDelete, children, }) {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({
        name: assetType.name,
        target_pct: String(assetType.target_pct ?? ''),
        sort_order: String(assetType.sort_order ?? ''),
    });
    const [isSaving, setIsSaving] = useState(false);
    const handleSave = useCallback(async () => {
        if (!form.name.trim())
            return;
        setIsSaving(true);
        try {
            await onUpdate(assetType.id, {
                name: form.name.trim(),
                target_pct: form.target_pct ? Number(form.target_pct) : null,
                sort_order: form.sort_order ? Number(form.sort_order) : null,
            });
            setIsEditing(false);
        }
        finally {
            setIsSaving(false);
        }
    }, [form, assetType.id, onUpdate]);
    const handleCancel = useCallback(() => {
        setForm({
            name: assetType.name,
            target_pct: String(assetType.target_pct ?? ''),
            sort_order: String(assetType.sort_order ?? ''),
        });
        setIsEditing(false);
    }, [assetType]);
    if (isEditing) {
        return (_jsx("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-2", "data-testid": "class-edit-form", children: _jsxs(FormRow, { children: [_jsx(FormField, { label: "Nome", className: "flex-1 min-w-[120px]", children: _jsx("input", { className: INPUT_BASE, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), autoFocus: true }) }), _jsx(FormField, { label: "Target %", className: "w-20", children: _jsx("input", { className: INPUT_BASE, type: "number", min: 0, max: 100, value: form.target_pct, onChange: (e) => setForm({ ...form, target_pct: e.target.value }) }) }), _jsx(FormField, { label: "Ordem", className: "w-16", children: _jsx("input", { className: INPUT_BASE, type: "number", value: form.sort_order, onChange: (e) => setForm({ ...form, sort_order: e.target.value }) }) }), _jsxs("div", { className: "flex gap-1 pt-3", children: [_jsx("button", { type: "button", onClick: handleSave, disabled: isSaving || !form.name.trim(), className: "rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-300", children: isSaving ? 'Salvando...' : 'Salvar' }), _jsx("button", { type: "button", onClick: handleCancel, className: "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50", children: "Cancelar" })] })] }) }));
    }
    return (_jsxs("div", { "data-testid": "class-node", children: [_jsxs("div", { className: "flex items-center gap-2 py-1.5", children: [_jsx("button", { type: "button", onClick: onToggle, className: "flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100", "aria-label": isExpanded ? 'Recolher' : 'Expandir', "aria-expanded": isExpanded, children: _jsx("svg", { className: `h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`, viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z", clipRule: "evenodd" }) }) }), _jsx("span", { className: "font-semibold text-sm text-gray-900", children: assetType.name }), assetType.target_pct !== null && (_jsxs("span", { className: "text-xs text-gray-500", children: ["(Target: ", assetType.target_pct, "%)"] })), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx("button", { type: "button", onClick: () => setIsEditing(true), className: "text-xs text-blue-600 hover:text-blue-800", "data-testid": "class-edit-btn", children: "[editar]" }), _jsx("button", { type: "button", onClick: () => onDelete(assetType.id), className: "text-xs text-red-600 hover:text-red-800", "data-testid": "class-delete-btn", children: "[excluir]" })] })] }), isExpanded && _jsx("div", { className: "ml-5 border-l border-gray-200 pl-3", children: children })] }));
}
export function GroupNode({ group, isExpanded, onToggle, onUpdate, onDelete, children, }) {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({
        name: group.name ?? '',
        target_pct: String(group.target_pct ?? ''),
        scoring_method: group.scoring_method,
    });
    const [isSaving, setIsSaving] = useState(false);
    const handleSave = useCallback(async () => {
        if (!form.name.trim())
            return;
        setIsSaving(true);
        try {
            await onUpdate(group.id, {
                name: form.name.trim(),
                target_pct: form.target_pct ? Number(form.target_pct) : null,
                scoring_method: form.scoring_method,
            });
            setIsEditing(false);
        }
        finally {
            setIsSaving(false);
        }
    }, [form, group.id, onUpdate]);
    const handleCancel = useCallback(() => {
        setForm({
            name: group.name ?? '',
            target_pct: String(group.target_pct ?? ''),
            scoring_method: group.scoring_method,
        });
        setIsEditing(false);
    }, [group]);
    if (isEditing) {
        return (_jsx("div", { className: "rounded-md border border-blue-200 bg-blue-50 p-2", "data-testid": "group-edit-form", children: _jsxs(FormRow, { children: [_jsx(FormField, { label: "Nome", className: "flex-1 min-w-[120px]", children: _jsx("input", { className: INPUT_BASE, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), autoFocus: true }) }), _jsx(FormField, { label: "Target %", className: "w-20", children: _jsx("input", { className: INPUT_BASE, type: "number", min: 0, max: 100, value: form.target_pct, onChange: (e) => setForm({ ...form, target_pct: e.target.value }) }) }), _jsx(FormField, { label: "Scoring", className: "w-32", children: _jsxs("select", { className: INPUT_BASE, value: form.scoring_method, onChange: (e) => setForm({ ...form, scoring_method: e.target.value }), children: [_jsx("option", { value: "manual", children: "Manual" }), _jsx("option", { value: "questionnaire", children: "Question\u00E1rio" })] }) }), _jsxs("div", { className: "flex gap-1 pt-3", children: [_jsx("button", { type: "button", onClick: handleSave, disabled: isSaving || !form.name.trim(), className: "rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-300", children: isSaving ? 'Salvando...' : 'Salvar' }), _jsx("button", { type: "button", onClick: handleCancel, className: "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50", children: "Cancelar" })] })] }) }));
    }
    return (_jsxs("div", { "data-testid": "group-node", children: [_jsxs("div", { className: "flex items-center gap-2 py-1", children: [_jsx("button", { type: "button", onClick: onToggle, className: "flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100", "aria-label": isExpanded ? 'Recolher' : 'Expandir', "aria-expanded": isExpanded, children: _jsx("svg", { className: `h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`, viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z", clipRule: "evenodd" }) }) }), _jsx("span", { className: "text-sm font-medium text-gray-800", children: group.name }), group.target_pct !== null && (_jsxs("span", { className: "text-xs text-gray-500", children: ["\u2014 ", group.target_pct, "%"] })), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx("button", { type: "button", onClick: () => setIsEditing(true), className: "text-xs text-blue-600 hover:text-blue-800", "data-testid": "group-edit-btn", children: "[editar]" }), _jsx("button", { type: "button", onClick: () => onDelete(group.id), className: "text-xs text-red-600 hover:text-red-800", "data-testid": "group-delete-btn", children: "[excluir]" })] })] }), isExpanded && _jsx("div", { className: "ml-5 border-l border-gray-200 pl-3", children: children })] }));
}
export function AssetNode({ asset, onEdit, onDelete }) {
    const modeLabel = asset.weight_mode === 'questionnaire' ? 'questionário' : 'manual';
    const weight = asset.weight_mode === 'manual' ? asset.manual_weight : '—';
    return (_jsxs("div", { className: "flex items-center gap-2 py-1 text-sm", "data-testid": "asset-node", children: [_jsx("span", { className: "font-mono font-medium text-gray-900", children: asset.ticker }), asset.name && _jsxs("span", { className: "text-gray-500 hidden md:inline", children: ["(", asset.name, ")"] }), _jsxs("span", { className: "text-xs text-gray-500", "data-testid": "asset-weight-display", children: ["peso: ", weight, " (", modeLabel, ")"] }), !asset.is_active && (_jsx("span", { className: "rounded bg-gray-200 px-1 text-xs text-gray-600", children: "inativo" })), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx("button", { type: "button", onClick: () => onEdit(asset), className: "text-xs text-blue-600 hover:text-blue-800", "data-testid": "asset-edit-btn", children: "[editar]" }), _jsx("button", { type: "button", onClick: () => onDelete(asset.id), className: "text-xs text-red-600 hover:text-red-800", "data-testid": "asset-delete-btn", children: "[excluir]" })] })] }));
}
export function CreateClassForm({ walletId, userId, onCreate, onCancel }) {
    const [form, setForm] = useState({ name: '', target_pct: '', sort_order: '' });
    const [isSaving, setIsSaving] = useState(false);
    const handleSubmit = useCallback(async () => {
        if (!form.name.trim())
            return;
        setIsSaving(true);
        try {
            await onCreate({
                name: form.name.trim(),
                target_pct: form.target_pct ? Number(form.target_pct) : null,
                sort_order: form.sort_order ? Number(form.sort_order) : null,
                user_id: userId,
                wallet_id: walletId,
            });
        }
        finally {
            setIsSaving(false);
        }
    }, [form, walletId, userId, onCreate]);
    return (_jsx("div", { className: "rounded-md border border-green-200 bg-green-50 p-2", "data-testid": "create-class-form", children: _jsxs(FormRow, { children: [_jsx(FormField, { label: "Nome *", className: "flex-1 min-w-[120px]", children: _jsx("input", { className: INPUT_BASE, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Nome da classe", autoFocus: true }) }), _jsx(FormField, { label: "Target %", className: "w-20", children: _jsx("input", { className: INPUT_BASE, type: "number", min: 0, max: 100, value: form.target_pct, onChange: (e) => setForm({ ...form, target_pct: e.target.value }) }) }), _jsx(FormField, { label: "Ordem", className: "w-16", children: _jsx("input", { className: INPUT_BASE, type: "number", value: form.sort_order, onChange: (e) => setForm({ ...form, sort_order: e.target.value }) }) }), _jsxs("div", { className: "flex gap-1 pt-3", children: [_jsx("button", { type: "button", onClick: handleSubmit, disabled: isSaving || !form.name.trim(), className: "rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300", children: isSaving ? 'Criando...' : 'Criar' }), _jsx("button", { type: "button", onClick: onCancel, className: "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50", children: "Cancelar" })] })] }) }));
}
export function CreateGroupForm({ typeId, walletId, userId, onCreate, onCancel }) {
    const [form, setForm] = useState({ name: '', target_pct: '', scoring_method: 'manual' });
    const [isSaving, setIsSaving] = useState(false);
    const handleSubmit = useCallback(async () => {
        if (!form.name.trim())
            return;
        setIsSaving(true);
        try {
            await onCreate({
                type_id: typeId,
                name: form.name.trim(),
                target_pct: form.target_pct ? Number(form.target_pct) : null,
                scoring_method: form.scoring_method,
                user_id: userId,
                wallet_id: walletId,
            });
        }
        finally {
            setIsSaving(false);
        }
    }, [form, typeId, walletId, userId, onCreate]);
    return (_jsx("div", { className: "rounded-md border border-green-200 bg-green-50 p-2", "data-testid": "create-group-form", children: _jsxs(FormRow, { children: [_jsx(FormField, { label: "Nome *", className: "flex-1 min-w-[120px]", children: _jsx("input", { className: INPUT_BASE, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Nome do grupo", autoFocus: true }) }), _jsx(FormField, { label: "Target %", className: "w-20", children: _jsx("input", { className: INPUT_BASE, type: "number", min: 0, max: 100, value: form.target_pct, onChange: (e) => setForm({ ...form, target_pct: e.target.value }) }) }), _jsx(FormField, { label: "Scoring", className: "w-32", children: _jsxs("select", { className: INPUT_BASE, value: form.scoring_method, onChange: (e) => setForm({ ...form, scoring_method: e.target.value }), children: [_jsx("option", { value: "manual", children: "Manual" }), _jsx("option", { value: "questionnaire", children: "Question\u00E1rio" })] }) }), _jsxs("div", { className: "flex gap-1 pt-3", children: [_jsx("button", { type: "button", onClick: handleSubmit, disabled: isSaving || !form.name.trim(), className: "rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300", children: isSaving ? 'Criando...' : 'Criar' }), _jsx("button", { type: "button", onClick: onCancel, className: "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50", children: "Cancelar" })] })] }) }));
}
export function CreateAssetForm({ groupId, walletId, userId, onCreate, onCancel }) {
    const [form, setForm] = useState({
        ticker: '',
        name: '',
        sector: '',
        quantity: '0',
        price_source: 'brapi',
        is_active: true,
        manual_override: false,
        whole_shares: true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const handleSubmit = useCallback(async () => {
        if (!form.ticker.trim())
            return;
        setIsSaving(true);
        try {
            await onCreate({
                ticker: form.ticker.trim().toUpperCase(),
                name: form.name.trim() || null,
                sector: form.sector.trim() || null,
                quantity: Number(form.quantity) || 0,
                group_id: groupId,
                price_source: form.price_source,
                is_active: form.is_active,
                manual_override: form.manual_override,
                whole_shares: form.whole_shares,
                bought: false,
                sold: false,
                weight_mode: 'manual',
                manual_weight: 0,
                user_id: userId,
                wallet_id: walletId,
            });
        }
        finally {
            setIsSaving(false);
        }
    }, [form, groupId, walletId, userId, onCreate]);
    return (_jsxs("div", { className: "rounded-md border border-green-200 bg-green-50 p-2", "data-testid": "create-asset-form", children: [_jsxs(FormRow, { children: [_jsx(FormField, { label: "Ticker *", className: "w-24", children: _jsx("input", { className: INPUT_BASE, value: form.ticker, onChange: (e) => setForm({ ...form, ticker: e.target.value }), placeholder: "Ex: PETR4", autoFocus: true }) }), _jsx(FormField, { label: "Nome", className: "flex-1 min-w-[100px]", children: _jsx("input", { className: INPUT_BASE, value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Opcional" }) }), _jsx(FormField, { label: "Setor", className: "w-24", children: _jsx("input", { className: INPUT_BASE, value: form.sector, onChange: (e) => setForm({ ...form, sector: e.target.value }), placeholder: "Opcional" }) }), _jsx(FormField, { label: "Qtd", className: "w-20", children: _jsx("input", { className: INPUT_BASE, type: "number", min: 0, value: form.quantity, onChange: (e) => setForm({ ...form, quantity: e.target.value }) }) }), _jsx(FormField, { label: "Pre\u00E7o", className: "w-24", children: _jsx("select", { className: INPUT_BASE, value: form.price_source, onChange: (e) => setForm({ ...form, price_source: e.target.value }), children: PRICE_SOURCES.map((ps) => (_jsx("option", { value: ps.value, children: ps.label }, ps.value))) }) })] }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-4 text-xs", children: [_jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.is_active, onChange: (e) => setForm({ ...form, is_active: e.target.checked }), className: "h-3.5 w-3.5 rounded border-gray-300" }), _jsx("span", { className: "text-gray-700", children: "Ativo" })] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.manual_override, onChange: (e) => setForm({ ...form, manual_override: e.target.checked }), className: "h-3.5 w-3.5 rounded border-gray-300" }), _jsx("span", { className: "text-gray-700", children: "Override manual" })] }), _jsxs("label", { className: "flex items-center gap-1 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.whole_shares, onChange: (e) => setForm({ ...form, whole_shares: e.target.checked }), className: "h-3.5 w-3.5 rounded border-gray-300" }), _jsx("span", { className: "text-gray-700", children: "A\u00E7\u00F5es inteiras" })] }), _jsxs("div", { className: "ml-auto flex gap-1", children: [_jsx("button", { type: "button", onClick: handleSubmit, disabled: isSaving || !form.ticker.trim(), className: "rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300", children: isSaving ? 'Criando...' : 'Criar' }), _jsx("button", { type: "button", onClick: onCancel, className: "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50", children: "Cancelar" })] })] })] }));
}
