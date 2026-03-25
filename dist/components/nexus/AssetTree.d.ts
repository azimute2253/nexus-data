import type { Asset, AssetType, AssetGroup, AssetTypeInsert, AssetTypeUpdate, AssetGroupInsert, AssetGroupUpdate, AssetInsert } from '../../lib/nexus/types.js';
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
export declare function AssetTree({ assetTypes, groups, assets, walletId, userId, onCreateClass, onUpdateClass, onDeleteClass, onCreateGroup, onUpdateGroup, onDeleteGroup, onCreateAsset, onEditAsset, onDeleteAsset, }: AssetTreeProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AssetTree.d.ts.map