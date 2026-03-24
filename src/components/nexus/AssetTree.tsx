// ============================================================
// Nexus Data — Asset Tree Component
// Recursive hierarchical tree: Classes → Groups → Assets.
// Manages expand/collapse state and inline create forms.
// [Story 15.3]
// ============================================================

import { useState, useCallback } from 'react';
import type {
  Asset,
  AssetType,
  AssetGroup,
  AssetTypeInsert,
  AssetTypeUpdate,
  AssetGroupInsert,
  AssetGroupUpdate,
  AssetInsert,
} from '../../lib/nexus/types.js';
import {
  ClassNode,
  GroupNode,
  AssetNode,
  CreateClassForm,
  CreateGroupForm,
  CreateAssetForm,
} from './AssetTreeNode.js';
import { TargetWarning } from './TargetWarning.js';

// ---------- Props ----------

export interface AssetTreeProps {
  assetTypes: AssetType[];
  groups: AssetGroup[];
  assets: Asset[];
  walletId: string;
  userId: string;
  onCreateClass: (input: AssetTypeInsert) => Promise<void>;
  onUpdateClass: (id: string, updates: AssetTypeUpdate) => Promise<void>;
  onDeleteClass: (id: string) => void;
  onCreateGroup: (input: AssetGroupInsert) => Promise<void>;
  onUpdateGroup: (id: string, updates: AssetGroupUpdate) => Promise<void>;
  onDeleteGroup: (id: string) => void;
  onCreateAsset: (input: AssetInsert) => Promise<void>;
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
}

// ---------- Main component ----------

export function AssetTree({
  assetTypes,
  groups,
  assets,
  walletId,
  userId,
  onCreateClass,
  onUpdateClass,
  onDeleteClass,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateAsset,
  onEditAsset,
  onDeleteAsset,
}: AssetTreeProps) {
  // Expand/collapse state per node
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    () => new Set(assetTypes.map((t) => t.id)),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  );

  // Create form visibility
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [createGroupForType, setCreateGroupForType] = useState<string | null>(null);
  const [createAssetForGroup, setCreateAssetForGroup] = useState<string | null>(null);

  // Toggle helpers
  const toggleClass = useCallback((id: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Create handlers (close form after success)
  const handleCreateClass = useCallback(async (input: AssetTypeInsert) => {
    await onCreateClass(input);
    setShowCreateClass(false);
  }, [onCreateClass]);

  const handleCreateGroup = useCallback(async (input: AssetGroupInsert) => {
    await onCreateGroup(input);
    setCreateGroupForType(null);
  }, [onCreateGroup]);

  const handleCreateAsset = useCallback(async (input: AssetInsert) => {
    await onCreateAsset(input);
    setCreateAssetForGroup(null);
  }, [onCreateAsset]);

  // Group assets by group_id for efficient lookup
  const assetsByGroup = new Map<string, Asset[]>();
  for (const asset of assets) {
    const list = assetsByGroup.get(asset.group_id) ?? [];
    list.push(asset);
    assetsByGroup.set(asset.group_id, list);
  }

  // Group groups by type_id
  const groupsByType = new Map<string, AssetGroup[]>();
  for (const group of groups) {
    const list = groupsByType.get(group.type_id) ?? [];
    list.push(group);
    groupsByType.set(group.type_id, list);
  }

  // Target % sum for classes
  const classTargetSum = assetTypes.reduce(
    (sum, t) => sum + (t.target_pct ?? 0),
    0,
  );

  return (
    <div className="space-y-1" data-testid="asset-tree">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-sm font-semibold text-gray-700">Classes de Ativo</h3>
        <button
          type="button"
          onClick={() => setShowCreateClass(true)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          data-testid="add-class-btn"
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Nova Classe
        </button>
      </div>

      {/* AC9: Target % sum warning for classes */}
      {assetTypes.length > 0 && (
        <TargetWarning sum={classTargetSum} label="das classes" />
      )}

      {/* Create class form */}
      {showCreateClass && (
        <CreateClassForm
          walletId={walletId}
          userId={userId}
          onCreate={handleCreateClass}
          onCancel={() => setShowCreateClass(false)}
        />
      )}

      {/* Empty state */}
      {assetTypes.length === 0 && !showCreateClass && (
        <div className="py-8 text-center" data-testid="empty-tree">
          <p className="text-sm text-gray-500">Comece adicionando uma classe de ativo</p>
        </div>
      )}

      {/* Tree */}
      {assetTypes.map((assetType) => {
        const typeGroups = groupsByType.get(assetType.id) ?? [];

        // AC10: Target % sum warning for groups within class
        const groupTargetSum = typeGroups.reduce(
          (sum, g) => sum + (g.target_pct ?? 0),
          0,
        );

        return (
          <ClassNode
            key={assetType.id}
            assetType={assetType}
            isExpanded={expandedClasses.has(assetType.id)}
            onToggle={() => toggleClass(assetType.id)}
            onUpdate={onUpdateClass}
            onDelete={onDeleteClass}
          >
            {/* Group target warning (AC10: >1pp tolerance) */}
            {typeGroups.length > 0 && (
              <TargetWarning
                sum={groupTargetSum}
                label={`dos grupos em ${assetType.name}`}
                tolerancePp={1}
              />
            )}

            {/* Add group button */}
            {createGroupForType === assetType.id ? (
              <CreateGroupForm
                typeId={assetType.id}
                walletId={walletId}
                userId={userId}
                onCreate={handleCreateGroup}
                onCancel={() => setCreateGroupForType(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreateGroupForType(assetType.id)}
                className="flex items-center gap-1 py-1 text-xs text-green-700 hover:text-green-900"
                data-testid="add-group-btn"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Novo Grupo
              </button>
            )}

            {/* Groups */}
            {typeGroups.map((group) => {
              const groupAssets = assetsByGroup.get(group.id) ?? [];

              return (
                <GroupNode
                  key={group.id}
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onUpdate={onUpdateGroup}
                  onDelete={onDeleteGroup}
                >
                  {/* Add asset button */}
                  {createAssetForGroup === group.id ? (
                    <CreateAssetForm
                      groupId={group.id}
                      walletId={walletId}
                      userId={userId}
                      onCreate={handleCreateAsset}
                      onCancel={() => setCreateAssetForGroup(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreateAssetForGroup(group.id)}
                      className="flex items-center gap-1 py-1 text-xs text-green-700 hover:text-green-900"
                      data-testid="add-asset-btn"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                      Novo Ativo
                    </button>
                  )}

                  {/* Assets */}
                  {groupAssets.map((asset) => (
                    <AssetNode
                      key={asset.id}
                      asset={asset}
                      onEdit={onEditAsset}
                      onDelete={onDeleteAsset}
                    />
                  ))}
                </GroupNode>
              );
            })}
          </ClassNode>
        );
      })}
    </div>
  );
}
