// ============================================================
// Nexus Data — Asset Tree Node Component
// Individual tree node with inline CRUD for class, group, or asset.
// Handles create/edit forms and delete confirmation inline.
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
  AssetUpdate,
  PriceSource,
  WeightMode,
} from '../../lib/nexus/types.js';

// ---------- Price source options ----------

const PRICE_SOURCES: { value: PriceSource; label: string }[] = [
  { value: 'brapi', label: 'BRAPI' },
  { value: 'yahoo', label: 'Yahoo' },
  { value: 'manual', label: 'Manual' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'exchange', label: 'Exchange' },
];

// ---------- Inline form types ----------

interface ClassFormData {
  name: string;
  target_pct: string;
}

interface GroupFormData {
  name: string;
  target_pct: string;
  scoring_method: string;
}

interface AssetFormData {
  ticker: string;
  name: string;
  sector: string;
  quantity: string;
  price_source: PriceSource;
  is_active: boolean;
  manual_override: boolean;
  whole_shares: boolean;
}

// ---------- Shared inline form row ----------

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2">{children}</div>;
}

function FormField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const INPUT_BASE =
  'mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

// ============================================================
// Class node
// ============================================================

export interface ClassNodeProps {
  assetType: AssetType;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: AssetTypeUpdate) => Promise<void>;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}

export function ClassNode({
  assetType,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  children,
}: ClassNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ClassFormData>({
    name: assetType.name,
    target_pct: String(assetType.target_pct ?? ''),
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(assetType.id, {
        name: form.name.trim(),
        target_pct: form.target_pct ? Number(form.target_pct) : null,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [form, assetType.id, onUpdate]);

  const handleCancel = useCallback(() => {
    setForm({
      name: assetType.name,
      target_pct: String(assetType.target_pct ?? ''),
    });
    setIsEditing(false);
  }, [assetType]);

  if (isEditing) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-2" data-testid="class-edit-form">
        <FormRow>
          <FormField label="Nome" className="flex-1 min-w-[120px]">
            <input
              className={INPUT_BASE}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </FormField>
          <FormField label="Target %" className="w-20">
            <input
              className={INPUT_BASE}
              type="number"
              min={0}
              max={100}
              value={form.target_pct}
              onChange={(e) => setForm({ ...form, target_pct: e.target.value })}
            />
          </FormField>
          <div className="flex gap-1 pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.name.trim()}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </FormRow>
      </div>
    );
  }

  return (
    <div data-testid="class-node">
      <div className="flex items-center gap-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
          aria-label={isExpanded ? 'Recolher' : 'Expandir'}
          aria-expanded={isExpanded}
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="font-semibold text-sm text-gray-900">{assetType.name}</span>
        {assetType.target_pct !== null && (
          <span className="text-xs text-gray-500">(Target: {assetType.target_pct}%)</span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
            data-testid="class-edit-btn"
          >
            [editar]
          </button>
          <button
            type="button"
            onClick={() => onDelete(assetType.id)}
            className="text-xs text-red-600 hover:text-red-800"
            data-testid="class-delete-btn"
          >
            [excluir]
          </button>
        </div>
      </div>
      {isExpanded && <div className="ml-5 border-l border-gray-200 pl-3">{children}</div>}
    </div>
  );
}

// ============================================================
// Group node
// ============================================================

export interface GroupNodeProps {
  group: AssetGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: AssetGroupUpdate) => Promise<void>;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}

export function GroupNode({
  group,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
  children,
}: GroupNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<GroupFormData>({
    name: group.name ?? '',
    target_pct: String(group.target_pct ?? ''),
    scoring_method: group.scoring_method,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(group.id, {
        name: form.name.trim(),
        target_pct: form.target_pct ? Number(form.target_pct) : null,
        scoring_method: form.scoring_method,
      });
      setIsEditing(false);
    } finally {
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
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-2" data-testid="group-edit-form">
        <FormRow>
          <FormField label="Nome" className="flex-1 min-w-[120px]">
            <input
              className={INPUT_BASE}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </FormField>
          <FormField label="Target %" className="w-20">
            <input
              className={INPUT_BASE}
              type="number"
              min={0}
              max={100}
              value={form.target_pct}
              onChange={(e) => setForm({ ...form, target_pct: e.target.value })}
            />
          </FormField>
          <FormField label="Scoring" className="w-32">
            <select
              className={INPUT_BASE}
              value={form.scoring_method}
              onChange={(e) => setForm({ ...form, scoring_method: e.target.value })}
            >
              <option value="manual">Manual</option>
              <option value="questionnaire">Questionário</option>
            </select>
          </FormField>
          <div className="flex gap-1 pt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.name.trim()}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </FormRow>
      </div>
    );
  }

  return (
    <div data-testid="group-node">
      <div className="flex items-center gap-2 py-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          aria-label={isExpanded ? 'Recolher' : 'Expandir'}
          aria-expanded={isExpanded}
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-800">{group.name}</span>
        {group.target_pct !== null && (
          <span className="text-xs text-gray-500">— {group.target_pct}%</span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
            data-testid="group-edit-btn"
          >
            [editar]
          </button>
          <button
            type="button"
            onClick={() => onDelete(group.id)}
            className="text-xs text-red-600 hover:text-red-800"
            data-testid="group-delete-btn"
          >
            [excluir]
          </button>
        </div>
      </div>
      {isExpanded && <div className="ml-5 border-l border-gray-200 pl-3">{children}</div>}
    </div>
  );
}

// ============================================================
// Asset leaf node
// ============================================================

export interface AssetNodeProps {
  asset: Asset;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

export function AssetNode({ asset, onEdit, onDelete }: AssetNodeProps) {
  const modeLabel = asset.weight_mode === 'questionnaire' ? 'questionário' : 'manual';
  const weight = asset.weight_mode === 'manual' ? asset.manual_weight : '—';

  return (
    <div
      className="flex items-center gap-2 py-1 text-sm"
      data-testid="asset-node"
    >
      <span className="font-mono font-medium text-gray-900">{asset.ticker}</span>
      {asset.name && <span className="text-gray-500 hidden md:inline">({asset.name})</span>}
      <span className="text-xs text-gray-500" data-testid="asset-weight-display">
        peso: {weight} ({modeLabel})
      </span>
      {!asset.is_active && (
        <span className="rounded bg-gray-200 px-1 text-xs text-gray-600">inativo</span>
      )}
      <div className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => onEdit(asset)}
          className="text-xs text-blue-600 hover:text-blue-800"
          data-testid="asset-edit-btn"
        >
          [editar]
        </button>
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          className="text-xs text-red-600 hover:text-red-800"
          data-testid="asset-delete-btn"
        >
          [excluir]
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Create forms (inline)
// ============================================================

export interface CreateClassFormProps {
  walletId: string;
  userId: string;
  onCreate: (input: AssetTypeInsert) => Promise<void>;
  onCancel: () => void;
}

export function CreateClassForm({ walletId, userId, onCreate, onCancel }: CreateClassFormProps) {
  const [form, setForm] = useState<ClassFormData>({ name: '', target_pct: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await onCreate({
        name: form.name.trim(),
        target_pct: form.target_pct ? Number(form.target_pct) : null,
        sort_order: null,
        user_id: userId,
        wallet_id: walletId,
      });
    } finally {
      setIsSaving(false);
    }
  }, [form, walletId, userId, onCreate]);

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-2" data-testid="create-class-form">
      <FormRow>
        <FormField label="Nome *" className="flex-1 min-w-[120px]">
          <input
            className={INPUT_BASE}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome da classe"
            autoFocus
          />
        </FormField>
        <FormField label="Target %" className="w-20">
          <input
            className={INPUT_BASE}
            type="number"
            min={0}
            max={100}
            value={form.target_pct}
            onChange={(e) => setForm({ ...form, target_pct: e.target.value })}
          />
        </FormField>
        <div className="flex gap-1 pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !form.name.trim()}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
          >
            {isSaving ? 'Criando...' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </FormRow>
    </div>
  );
}

export interface CreateGroupFormProps {
  typeId: string;
  walletId: string;
  userId: string;
  onCreate: (input: AssetGroupInsert) => Promise<void>;
  onCancel: () => void;
}

export function CreateGroupForm({ typeId, walletId, userId, onCreate, onCancel }: CreateGroupFormProps) {
  const [form, setForm] = useState<GroupFormData>({ name: '', target_pct: '', scoring_method: 'manual' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return;
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
    } finally {
      setIsSaving(false);
    }
  }, [form, typeId, walletId, userId, onCreate]);

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-2" data-testid="create-group-form">
      <FormRow>
        <FormField label="Nome *" className="flex-1 min-w-[120px]">
          <input
            className={INPUT_BASE}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome do grupo"
            autoFocus
          />
        </FormField>
        <FormField label="Target %" className="w-20">
          <input
            className={INPUT_BASE}
            type="number"
            min={0}
            max={100}
            value={form.target_pct}
            onChange={(e) => setForm({ ...form, target_pct: e.target.value })}
          />
        </FormField>
        <FormField label="Scoring" className="w-32">
          <select
            className={INPUT_BASE}
            value={form.scoring_method}
            onChange={(e) => setForm({ ...form, scoring_method: e.target.value })}
          >
            <option value="manual">Manual</option>
            <option value="questionnaire">Questionário</option>
          </select>
        </FormField>
        <div className="flex gap-1 pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !form.name.trim()}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
          >
            {isSaving ? 'Criando...' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </FormRow>
    </div>
  );
}

export interface CreateAssetFormProps {
  groupId: string;
  walletId: string;
  userId: string;
  onCreate: (input: AssetInsert) => Promise<void>;
  onCancel: () => void;
}

export function CreateAssetForm({ groupId, walletId, userId, onCreate, onCancel }: CreateAssetFormProps) {
  const [form, setForm] = useState<AssetFormData>({
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
    if (!form.ticker.trim()) return;
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
        weight_mode: 'manual' as WeightMode,
        manual_weight: 0,
        user_id: userId,
        wallet_id: walletId,
      });
    } finally {
      setIsSaving(false);
    }
  }, [form, groupId, walletId, userId, onCreate]);

  return (
    <div className="rounded-md border border-green-200 bg-green-50 p-2" data-testid="create-asset-form">
      <FormRow>
        <FormField label="Ticker *" className="w-24">
          <input
            className={INPUT_BASE}
            value={form.ticker}
            onChange={(e) => setForm({ ...form, ticker: e.target.value })}
            placeholder="Ex: PETR4"
            autoFocus
          />
        </FormField>
        <FormField label="Nome" className="flex-1 min-w-[100px]">
          <input
            className={INPUT_BASE}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Opcional"
          />
        </FormField>
        <FormField label="Setor" className="w-24">
          <input
            className={INPUT_BASE}
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            placeholder="Opcional"
          />
        </FormField>
        <FormField label="Qtd" className="w-20">
          <input
            className={INPUT_BASE}
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </FormField>
        <FormField label="Preço" className="w-24">
          <select
            className={INPUT_BASE}
            value={form.price_source}
            onChange={(e) => setForm({ ...form, price_source: e.target.value as PriceSource })}
          >
            {PRICE_SOURCES.map((ps) => (
              <option key={ps.value} value={ps.value}>{ps.label}</option>
            ))}
          </select>
        </FormField>
      </FormRow>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-gray-700">Ativo</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.manual_override}
            onChange={(e) => setForm({ ...form, manual_override: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-gray-700">Override manual</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.whole_shares}
            onChange={(e) => setForm({ ...form, whole_shares: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-gray-700">Ações inteiras</span>
        </label>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !form.ticker.trim()}
            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
          >
            {isSaving ? 'Criando...' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
