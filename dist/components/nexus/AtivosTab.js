import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Ativos Tab Component
// Hierarchical tree (Classes → Groups → Assets) with inline
// CRUD and DualWeightPanel modal integration.
// All data filtered by active wallet_id (ADR-014).
// [Story 15.3, PRD F-031]
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getAssetTypes, createAssetType, updateAssetType, deleteAssetType } from '../../lib/nexus/asset-types.js';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../lib/nexus/groups.js';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../../lib/nexus/assets.js';
import { getQuestionnaires } from '../../lib/nexus/questionnaires.js';
import { getAssetScore, saveAssetScore } from '../../lib/nexus/asset-scores.js';
import { AssetTree } from './AssetTree.js';
import { DualWeightPanel } from './DualWeightPanel.js';
import { ConfirmDialog } from './ConfirmDialog.js';
// ---------- Helper: compute weight % for an asset within its group ----------
function computeWeightPct(asset, allAssets) {
    const groupAssets = allAssets.filter((a) => a.group_id === asset.group_id && a.is_active);
    if (groupAssets.length === 0)
        return null;
    const getRawWeight = (a) => a.weight_mode === 'manual' ? a.manual_weight : 0;
    const total = groupAssets.reduce((sum, a) => sum + Math.max(0, getRawWeight(a)), 0);
    if (total === 0)
        return null;
    const raw = Math.max(0, getRawWeight(asset));
    return (raw / total) * 100;
}
// ---------- Main component ----------
export function AtivosTab({ walletId, userId }) {
    // Data state
    const [assetTypes, setAssetTypes] = useState([]);
    const [groups, setGroups] = useState([]);
    const [assets, setAssets] = useState([]);
    const [questionnaires, setQuestionnaires] = useState([]);
    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [weightPanel, setWeightPanel] = useState(null);
    // ── Data loading ──────────────────────────────────────────
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [typesData, groupsData, assetsData, questData] = await Promise.all([
                getAssetTypes(walletId),
                getGroups(walletId),
                getAssets(walletId),
                getQuestionnaires(walletId),
            ]);
            setAssetTypes(typesData);
            setGroups(groupsData);
            setAssets(assetsData);
            setQuestionnaires(questData);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        }
        finally {
            setIsLoading(false);
        }
    }, [walletId]);
    useEffect(() => {
        loadData();
    }, [loadData]);
    // ── Class CRUD ────────────────────────────────────────────
    const handleCreateClass = useCallback(async (input) => {
        const created = await createAssetType(input);
        setAssetTypes((prev) => [...prev, created]);
    }, []);
    const handleUpdateClass = useCallback(async (id, updates) => {
        const updated = await updateAssetType(id, updates);
        setAssetTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }, []);
    const handleDeleteClassRequest = useCallback((id) => {
        const cls = assetTypes.find((t) => t.id === id);
        if (!cls)
            return;
        setDeleteTarget({ type: 'class', id, name: cls.name });
    }, [assetTypes]);
    const handleDeleteClassConfirm = useCallback(async () => {
        if (!deleteTarget || deleteTarget.type !== 'class')
            return;
        await deleteAssetType(deleteTarget.id);
        setAssetTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        // Cascade: remove associated groups and assets from local state
        const deletedGroupIds = new Set(groups.filter((g) => g.type_id === deleteTarget.id).map((g) => g.id));
        setGroups((prev) => prev.filter((g) => g.type_id !== deleteTarget.id));
        setAssets((prev) => prev.filter((a) => !deletedGroupIds.has(a.group_id)));
        setDeleteTarget(null);
    }, [deleteTarget, groups]);
    // ── Group CRUD ────────────────────────────────────────────
    const handleCreateGroup = useCallback(async (input) => {
        const created = await createGroup(input);
        setGroups((prev) => [...prev, created]);
    }, []);
    const handleUpdateGroup = useCallback(async (id, updates) => {
        const updated = await updateGroup(id, updates);
        setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
    }, []);
    const handleDeleteGroupRequest = useCallback((id) => {
        const grp = groups.find((g) => g.id === id);
        if (!grp)
            return;
        setDeleteTarget({ type: 'group', id, name: grp.name ?? 'Grupo' });
    }, [groups]);
    const handleDeleteGroupConfirm = useCallback(async () => {
        if (!deleteTarget || deleteTarget.type !== 'group')
            return;
        await deleteGroup(deleteTarget.id);
        setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
        // Cascade: remove associated assets from local state
        setAssets((prev) => prev.filter((a) => a.group_id !== deleteTarget.id));
        setDeleteTarget(null);
    }, [deleteTarget]);
    // ── Asset CRUD ────────────────────────────────────────────
    const handleCreateAsset = useCallback(async (input) => {
        const created = await createAsset(input);
        setAssets((prev) => [...prev, created]);
    }, []);
    const handleEditAsset = useCallback(async (asset) => {
        // Find the questionnaire for this asset's type
        const group = groups.find((g) => g.id === asset.group_id);
        const typeId = group?.type_id;
        const questionnaire = typeId
            ? questionnaires.find((q) => q.asset_type_id === typeId) ?? null
            : null;
        // Load saved score if questionnaire exists
        let savedScore = null;
        if (questionnaire) {
            try {
                savedScore = await getAssetScore(asset.id, questionnaire.id);
            }
            catch {
                // Score not found is OK
            }
        }
        setWeightPanel({ asset, questionnaire, savedScore });
    }, [groups, questionnaires]);
    const handleDeleteAssetRequest = useCallback((id) => {
        const a = assets.find((asset) => asset.id === id);
        if (!a)
            return;
        setDeleteTarget({ type: 'asset', id, ticker: a.ticker });
    }, [assets]);
    const handleDeleteAssetConfirm = useCallback(async () => {
        if (!deleteTarget || deleteTarget.type !== 'asset')
            return;
        await deleteAsset(deleteTarget.id);
        setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        setDeleteTarget(null);
    }, [deleteTarget]);
    // ── Unified delete confirm ────────────────────────────────
    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget)
            return;
        switch (deleteTarget.type) {
            case 'class':
                await handleDeleteClassConfirm();
                break;
            case 'group':
                await handleDeleteGroupConfirm();
                break;
            case 'asset':
                await handleDeleteAssetConfirm();
                break;
        }
    }, [deleteTarget, handleDeleteClassConfirm, handleDeleteGroupConfirm, handleDeleteAssetConfirm]);
    // ── DualWeightPanel save handlers ─────────────────────────
    const handleWeightSave = useCallback(async (id, updates) => {
        const updated = await updateAsset(id, updates);
        setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
        // Update panel state with fresh asset data
        setWeightPanel((prev) => prev ? { ...prev, asset: updated } : null);
    }, []);
    const handleScoreSave = useCallback(async (answers) => {
        if (!weightPanel?.questionnaire)
            return;
        const score = await saveAssetScore(weightPanel.asset.id, weightPanel.questionnaire.id, answers, weightPanel.questionnaire, userId, walletId);
        setWeightPanel((prev) => prev ? { ...prev, savedScore: score } : null);
    }, [weightPanel, userId, walletId]);
    // ── Delete dialog message builder ─────────────────────────
    function getDeleteMessage() {
        if (!deleteTarget)
            return '';
        switch (deleteTarget.type) {
            case 'class':
                return `Excluir a classe "${deleteTarget.name}"? Todos os grupos e ativos associados serão removidos.`;
            case 'group':
                return `Excluir o grupo "${deleteTarget.name}"? Todos os ativos associados serão removidos.`;
            case 'asset':
                return `Excluir o ativo "${deleteTarget.ticker}"?`;
        }
    }
    function getDeleteTitle() {
        if (!deleteTarget)
            return '';
        switch (deleteTarget.type) {
            case 'class':
                return 'Excluir classe';
            case 'group':
                return 'Excluir grupo';
            case 'asset':
                return 'Excluir ativo';
        }
    }
    // ── Loading state ─────────────────────────────────────────
    if (isLoading) {
        return (_jsx("div", { className: "space-y-3 p-4", "data-testid": "ativos-loading", children: [1, 2, 3].map((i) => (_jsx("div", { className: "h-8 animate-pulse rounded bg-gray-200" }, i))) }));
    }
    // ── Error state ───────────────────────────────────────────
    if (error) {
        return (_jsxs("div", { className: "p-4 text-center", "data-testid": "ativos-error", children: [_jsx("p", { className: "text-sm text-red-600", children: error }), _jsx("button", { type: "button", onClick: loadData, className: "mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700", children: "Tentar novamente" })] }));
    }
    // ── Main render ───────────────────────────────────────────
    return (_jsxs("div", { className: "p-4", "data-testid": "ativos-tab", children: [_jsx(AssetTree, { assetTypes: assetTypes, groups: groups, assets: assets, walletId: walletId, userId: userId, onCreateClass: handleCreateClass, onUpdateClass: handleUpdateClass, onDeleteClass: handleDeleteClassRequest, onCreateGroup: handleCreateGroup, onUpdateGroup: handleUpdateGroup, onDeleteGroup: handleDeleteGroupRequest, onCreateAsset: handleCreateAsset, onEditAsset: handleEditAsset, onDeleteAsset: handleDeleteAssetRequest }), _jsx(ConfirmDialog, { isOpen: deleteTarget !== null, title: getDeleteTitle(), message: getDeleteMessage(), confirmLabel: "Excluir", variant: "danger", onConfirm: handleDeleteConfirm, onCancel: () => setDeleteTarget(null) }), weightPanel && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50", role: "dialog", "aria-modal": "true", "aria-label": "Editar peso do ativo", onClick: (e) => {
                    if (e.target === e.currentTarget)
                        setWeightPanel(null);
                }, "data-testid": "weight-panel-modal", children: _jsxs("div", { className: "mx-4 w-full max-w-md", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("h2", { className: "text-sm font-semibold text-white", children: [weightPanel.asset.ticker, weightPanel.asset.name ? ` — ${weightPanel.asset.name}` : ''] }), _jsx("button", { type: "button", onClick: () => setWeightPanel(null), className: "rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white", "aria-label": "Fechar", children: _jsx("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { d: "M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" }) }) })] }), _jsx(DualWeightPanel, { asset: weightPanel.asset, questionnaire: weightPanel.questionnaire, savedScore: weightPanel.savedScore, weightPct: computeWeightPct(weightPanel.asset, assets), onSave: handleWeightSave, onSaveScore: handleScoreSave })] }) }))] }));
}
