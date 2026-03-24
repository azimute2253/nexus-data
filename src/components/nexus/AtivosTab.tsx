// ============================================================
// Nexus Data — Ativos Tab Component
// Hierarchical tree (Classes → Groups → Assets) with inline
// CRUD and DualWeightPanel modal integration.
// All data filtered by active wallet_id (ADR-014).
// [Story 15.3, PRD F-031]
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  Asset,
  AssetType,
  AssetGroup,
  AssetTypeInsert,
  AssetTypeUpdate,
  AssetGroupInsert,
  AssetGroupUpdate,
  AssetInsert,
  AssetUpdate,
  Questionnaire,
  AssetScore,
  ScoreAnswer,
} from '../../lib/nexus/types.js';
import { getAssetTypes, createAssetType, updateAssetType, deleteAssetType } from '../../lib/nexus/asset-types.js';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../lib/nexus/groups.js';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../../lib/nexus/assets.js';
import { getQuestionnaires } from '../../lib/nexus/questionnaires.js';
import { getAssetScore, saveAssetScore } from '../../lib/nexus/asset-scores.js';
import { AssetTree } from './AssetTree.js';
import { DualWeightPanel } from './DualWeightPanel.js';
import { ConfirmDialog } from './ConfirmDialog.js';

// ---------- Props ----------

export interface AtivosTabProps {
  walletId: string;
  userId: string;
}

// ---------- Delete target union ----------

type DeleteTarget =
  | { type: 'class'; id: string; name: string }
  | { type: 'group'; id: string; name: string }
  | { type: 'asset'; id: string; ticker: string };

// ---------- Weight panel state ----------

interface WeightPanelState {
  asset: Asset;
  questionnaire: Questionnaire | null;
  savedScore: AssetScore | null;
}

// ---------- Helper: compute weight % for an asset within its group ----------

function computeWeightPct(asset: Asset, allAssets: Asset[]): number | null {
  const groupAssets = allAssets.filter(
    (a) => a.group_id === asset.group_id && a.is_active,
  );
  if (groupAssets.length === 0) return null;

  const getRawWeight = (a: Asset) =>
    a.weight_mode === 'manual' ? a.manual_weight : 0;

  const total = groupAssets.reduce((sum, a) => sum + Math.max(0, getRawWeight(a)), 0);
  if (total === 0) return null;

  const raw = Math.max(0, getRawWeight(asset));
  return (raw / total) * 100;
}

// ---------- Main component ----------

export function AtivosTab({ walletId, userId }: AtivosTabProps) {
  // Data state
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [weightPanel, setWeightPanel] = useState<WeightPanelState | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Class CRUD ────────────────────────────────────────────

  const handleCreateClass = useCallback(async (input: AssetTypeInsert) => {
    const created = await createAssetType(input);
    setAssetTypes((prev) => [...prev, created]);
  }, []);

  const handleUpdateClass = useCallback(async (id: string, updates: AssetTypeUpdate) => {
    const updated = await updateAssetType(id, updates);
    setAssetTypes((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const handleDeleteClassRequest = useCallback((id: string) => {
    const cls = assetTypes.find((t) => t.id === id);
    if (!cls) return;
    setDeleteTarget({ type: 'class', id, name: cls.name });
  }, [assetTypes]);

  const handleDeleteClassConfirm = useCallback(async () => {
    if (!deleteTarget || deleteTarget.type !== 'class') return;
    await deleteAssetType(deleteTarget.id);
    setAssetTypes((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    // Cascade: remove associated groups and assets from local state
    const deletedGroupIds = new Set(
      groups.filter((g) => g.type_id === deleteTarget.id).map((g) => g.id),
    );
    setGroups((prev) => prev.filter((g) => g.type_id !== deleteTarget.id));
    setAssets((prev) => prev.filter((a) => !deletedGroupIds.has(a.group_id)));
    setDeleteTarget(null);
  }, [deleteTarget, groups]);

  // ── Group CRUD ────────────────────────────────────────────

  const handleCreateGroup = useCallback(async (input: AssetGroupInsert) => {
    const created = await createGroup(input);
    setGroups((prev) => [...prev, created]);
  }, []);

  const handleUpdateGroup = useCallback(async (id: string, updates: AssetGroupUpdate) => {
    const updated = await updateGroup(id, updates);
    setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
  }, []);

  const handleDeleteGroupRequest = useCallback((id: string) => {
    const grp = groups.find((g) => g.id === id);
    if (!grp) return;
    setDeleteTarget({ type: 'group', id, name: grp.name ?? 'Grupo' });
  }, [groups]);

  const handleDeleteGroupConfirm = useCallback(async () => {
    if (!deleteTarget || deleteTarget.type !== 'group') return;
    await deleteGroup(deleteTarget.id);
    setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    // Cascade: remove associated assets from local state
    setAssets((prev) => prev.filter((a) => a.group_id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  // ── Asset CRUD ────────────────────────────────────────────

  const handleCreateAsset = useCallback(async (input: AssetInsert) => {
    const created = await createAsset(input);
    setAssets((prev) => [...prev, created]);
  }, []);

  const handleEditAsset = useCallback(async (asset: Asset) => {
    // Find the questionnaire for this asset's type
    const group = groups.find((g) => g.id === asset.group_id);
    const typeId = group?.type_id;
    const questionnaire = typeId
      ? questionnaires.find((q) => q.asset_type_id === typeId) ?? null
      : null;

    // Load saved score if questionnaire exists
    let savedScore: AssetScore | null = null;
    if (questionnaire) {
      try {
        savedScore = await getAssetScore(asset.id, questionnaire.id);
      } catch {
        // Score not found is OK
      }
    }

    setWeightPanel({ asset, questionnaire, savedScore });
  }, [groups, questionnaires]);

  const handleDeleteAssetRequest = useCallback((id: string) => {
    const a = assets.find((asset) => asset.id === id);
    if (!a) return;
    setDeleteTarget({ type: 'asset', id, ticker: a.ticker });
  }, [assets]);

  const handleDeleteAssetConfirm = useCallback(async () => {
    if (!deleteTarget || deleteTarget.type !== 'asset') return;
    await deleteAsset(deleteTarget.id);
    setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
  }, [deleteTarget]);

  // ── Unified delete confirm ────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
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

  const handleWeightSave = useCallback(async (id: string, updates: AssetUpdate) => {
    const updated = await updateAsset(id, updates);
    setAssets((prev) => prev.map((a) => (a.id === id ? updated : a)));
    // Update panel state with fresh asset data
    setWeightPanel((prev) =>
      prev ? { ...prev, asset: updated } : null,
    );
  }, []);

  const handleScoreSave = useCallback(async (answers: ScoreAnswer[]) => {
    if (!weightPanel?.questionnaire) return;
    const score = await saveAssetScore(
      weightPanel.asset.id,
      weightPanel.questionnaire.id,
      answers,
      weightPanel.questionnaire,
      userId,
      walletId,
    );
    setWeightPanel((prev) =>
      prev ? { ...prev, savedScore: score } : null,
    );
  }, [weightPanel, userId, walletId]);

  // ── Delete dialog message builder ─────────────────────────

  function getDeleteMessage(): string {
    if (!deleteTarget) return '';
    switch (deleteTarget.type) {
      case 'class':
        return `Excluir a classe "${deleteTarget.name}"? Todos os grupos e ativos associados serão removidos.`;
      case 'group':
        return `Excluir o grupo "${deleteTarget.name}"? Todos os ativos associados serão removidos.`;
      case 'asset':
        return `Excluir o ativo "${deleteTarget.ticker}"?`;
    }
  }

  function getDeleteTitle(): string {
    if (!deleteTarget) return '';
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
    return (
      <div className="space-y-3 p-4" data-testid="ativos-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────

  if (error) {
    return (
      <div className="p-4 text-center" data-testid="ativos-error">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────

  return (
    <div className="p-4" data-testid="ativos-tab">
      <AssetTree
        assetTypes={assetTypes}
        groups={groups}
        assets={assets}
        walletId={walletId}
        userId={userId}
        onCreateClass={handleCreateClass}
        onUpdateClass={handleUpdateClass}
        onDeleteClass={handleDeleteClassRequest}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroupRequest}
        onCreateAsset={handleCreateAsset}
        onEditAsset={handleEditAsset}
        onDeleteAsset={handleDeleteAssetRequest}
      />

      {/* ConfirmDialog for all deletes */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={getDeleteTitle()}
        message={getDeleteMessage()}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* DualWeightPanel modal overlay (AC4) */}
      {weightPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Editar peso do ativo"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWeightPanel(null);
          }}
          data-testid="weight-panel-modal"
        >
          <div className="mx-4 w-full max-w-md">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {weightPanel.asset.ticker}
                {weightPanel.asset.name ? ` — ${weightPanel.asset.name}` : ''}
              </h2>
              <button
                type="button"
                onClick={() => setWeightPanel(null)}
                className="rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white"
                aria-label="Fechar"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <DualWeightPanel
              asset={weightPanel.asset}
              questionnaire={weightPanel.questionnaire}
              savedScore={weightPanel.savedScore}
              weightPct={computeWeightPct(weightPanel.asset, assets)}
              onSave={handleWeightSave}
              onSaveScore={handleScoreSave}
            />
          </div>
        </div>
      )}
    </div>
  );
}
