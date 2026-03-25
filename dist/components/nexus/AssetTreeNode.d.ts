import type { Asset, AssetType, AssetGroup, AssetTypeInsert, AssetTypeUpdate, AssetGroupInsert, AssetGroupUpdate, AssetInsert } from '../../lib/nexus/types.js';
export interface ClassNodeProps {
    assetType: AssetType;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdate: (id: string, updates: AssetTypeUpdate) => Promise<void>;
    onDelete: (id: string) => void;
    children: React.ReactNode;
}
export declare function ClassNode({ assetType, isExpanded, onToggle, onUpdate, onDelete, children, }: ClassNodeProps): import("react/jsx-runtime").JSX.Element;
export interface GroupNodeProps {
    group: AssetGroup;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdate: (id: string, updates: AssetGroupUpdate) => Promise<void>;
    onDelete: (id: string) => void;
    children: React.ReactNode;
}
export declare function GroupNode({ group, isExpanded, onToggle, onUpdate, onDelete, children, }: GroupNodeProps): import("react/jsx-runtime").JSX.Element;
export interface AssetNodeProps {
    asset: Asset;
    onEdit: (asset: Asset) => void;
    onDelete: (id: string) => void;
}
export declare function AssetNode({ asset, onEdit, onDelete }: AssetNodeProps): import("react/jsx-runtime").JSX.Element;
export interface CreateClassFormProps {
    walletId: string;
    userId: string;
    onCreate: (input: AssetTypeInsert) => Promise<void>;
    onCancel: () => void;
}
export declare function CreateClassForm({ walletId, userId, onCreate, onCancel }: CreateClassFormProps): import("react/jsx-runtime").JSX.Element;
export interface CreateGroupFormProps {
    typeId: string;
    walletId: string;
    userId: string;
    onCreate: (input: AssetGroupInsert) => Promise<void>;
    onCancel: () => void;
}
export declare function CreateGroupForm({ typeId, walletId, userId, onCreate, onCancel }: CreateGroupFormProps): import("react/jsx-runtime").JSX.Element;
export interface CreateAssetFormProps {
    groupId: string;
    walletId: string;
    userId: string;
    onCreate: (input: AssetInsert) => Promise<void>;
    onCancel: () => void;
}
export declare function CreateAssetForm({ groupId, walletId, userId, onCreate, onCancel }: CreateAssetFormProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AssetTreeNode.d.ts.map