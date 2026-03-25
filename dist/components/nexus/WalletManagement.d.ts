import type { Wallet } from '../../lib/nexus/types.js';
export interface WalletManagementProps {
    /** User ID for wallet operations */
    userId: string;
    /** Currently active wallet (if any) */
    activeWallet: Wallet | null;
    /** All loaded wallets */
    wallets: Wallet[];
    /** Called after create/rename/delete to refresh wallet list and active wallet */
    onWalletsChange: (wallets: Wallet[], activeWallet: Wallet | null) => void;
}
export declare function WalletManagement({ userId, activeWallet, wallets, onWalletsChange, }: WalletManagementProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=WalletManagement.d.ts.map