import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================================
// Nexus Data — Asset Tree Component
// Recursive hierarchical tree: Classes → Groups → Assets.
// Manages expand/collapse state and inline create forms.
// [Story 15.3]
// ============================================================
import { useState, useCallback } from 'react';
import { ClassNode, GroupNode, AssetNode, CreateClassForm, CreateGroupForm, CreateAssetForm, } from './AssetTreeNode.js';
import { TargetWarning } from './TargetWarning.js';
// ---------- Main component ----------
export function AssetTree({ assetTypes, groups, assets, walletId, userId, onCreateClass, onUpdateClass, onDeleteClass, onCreateGroup, onUpdateGroup, onDeleteGroup, onCreateAsset, onEditAsset, onDeleteAsset, }) {
    // Expand/collapse state per node
    const [expandedClasses, setExpandedClasses] = useState(() => new Set(assetTypes.map((t) => t.id)));
    const [expandedGroups, setExpandedGroups] = useState(() => new Set(groups.map((g) => g.id)));
    // Create form visibility
    const [showCreateClass, setShowCreateClass] = useState(false);
    const [createGroupForType, setCreateGroupForType] = useState(null);
    const [createAssetForGroup, setCreateAssetForGroup] = useState(null);
    // Toggle helpers
    const toggleClass = useCallback((id) => {
        setExpandedClasses((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }, []);
    const toggleGroup = useCallback((id) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }, []);
    // Create handlers (close form after success)
    const handleCreateClass = useCallback(async (input) => {
        await onCreateClass(input);
        setShowCreateClass(false);
    }, [onCreateClass]);
    const handleCreateGroup = useCallback(async (input) => {
        await onCreateGroup(input);
        setCreateGroupForType(null);
    }, [onCreateGroup]);
    const handleCreateAsset = useCallback(async (input) => {
        await onCreateAsset(input);
        setCreateAssetForGroup(null);
    }, [onCreateAsset]);
    // Group assets by group_id for efficient lookup
    const assetsByGroup = new Map();
    for (const asset of assets) {
        const list = assetsByGroup.get(asset.group_id) ?? [];
        list.push(asset);
        assetsByGroup.set(asset.group_id, list);
    }
    // Group groups by type_id
    const groupsByType = new Map();
    for (const group of groups) {
        const list = groupsByType.get(group.type_id) ?? [];
        list.push(group);
        groupsByType.set(group.type_id, list);
    }
    // Target % sum for classes
    const classTargetSum = assetTypes.reduce((sum, t) => sum + (t.target_pct ?? 0), 0);
    return (_jsxs("div", { className: "space-y-1", "data-testid": "asset-tree", children: [_jsxs("div", { className: "flex items-center justify-between pb-2", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-700", children: "Classes de Ativo" }), _jsxs("button", { type: "button", onClick: () => setShowCreateClass(true), className: "flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700", "data-testid": "add-class-btn", children: [_jsx("svg", { className: "h-3 w-3", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { d: "M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" }) }), "Nova Classe"] })] }), assetTypes.length > 0 && (_jsx(TargetWarning, { sum: classTargetSum, label: "das classes" })), showCreateClass && (_jsx(CreateClassForm, { walletId: walletId, userId: userId, onCreate: handleCreateClass, onCancel: () => setShowCreateClass(false) })), assetTypes.length === 0 && !showCreateClass && (_jsx("div", { className: "py-8 text-center", "data-testid": "empty-tree", children: _jsx("p", { className: "text-sm text-gray-500", children: "Comece adicionando uma classe de ativo" }) })), assetTypes.map((assetType) => {
                const typeGroups = groupsByType.get(assetType.id) ?? [];
                // AC10: Target % sum warning for groups within class
                const groupTargetSum = typeGroups.reduce((sum, g) => sum + (g.target_pct ?? 0), 0);
                return (_jsxs(ClassNode, { assetType: assetType, isExpanded: expandedClasses.has(assetType.id), onToggle: () => toggleClass(assetType.id), onUpdate: onUpdateClass, onDelete: onDeleteClass, children: [typeGroups.length > 0 && (_jsx(TargetWarning, { sum: groupTargetSum, label: `dos grupos em ${assetType.name}`, tolerancePp: 1 })), createGroupForType === assetType.id ? (_jsx(CreateGroupForm, { typeId: assetType.id, walletId: walletId, userId: userId, onCreate: handleCreateGroup, onCancel: () => setCreateGroupForType(null) })) : (_jsxs("button", { type: "button", onClick: () => setCreateGroupForType(assetType.id), className: "flex items-center gap-1 py-1 text-xs text-green-700 hover:text-green-900", "data-testid": "add-group-btn", children: [_jsx("svg", { className: "h-3 w-3", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { d: "M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" }) }), "Novo Grupo"] })), typeGroups.map((group) => {
                            const groupAssets = assetsByGroup.get(group.id) ?? [];
                            return (_jsxs(GroupNode, { group: group, isExpanded: expandedGroups.has(group.id), onToggle: () => toggleGroup(group.id), onUpdate: onUpdateGroup, onDelete: onDeleteGroup, children: [createAssetForGroup === group.id ? (_jsx(CreateAssetForm, { groupId: group.id, walletId: walletId, userId: userId, onCreate: handleCreateAsset, onCancel: () => setCreateAssetForGroup(null) })) : (_jsxs("button", { type: "button", onClick: () => setCreateAssetForGroup(group.id), className: "flex items-center gap-1 py-1 text-xs text-green-700 hover:text-green-900", "data-testid": "add-asset-btn", children: [_jsx("svg", { className: "h-3 w-3", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { d: "M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" }) }), "Novo Ativo"] })), groupAssets.map((asset) => (_jsx(AssetNode, { asset: asset, onEdit: onEditAsset, onDelete: onDeleteAsset }, asset.id)))] }, group.id));
                        })] }, assetType.id));
            })] }));
}
