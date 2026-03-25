import type { Wallet } from '../../lib/nexus/types.js';
export interface WalletSelectorProps {
    /** User ID to fetch wallets for */
    userId: string;
    /** Callback when active wallet changes */
    onWalletChange?: (wallet: Wallet) => void;
    /** Callback for "Nova carteira" button */
    onCreateWallet?: () => void;
}
export declare function WalletSelector({ userId, onWalletChange, onCreateWallet, }: WalletSelectorProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=WalletSelector.d.ts.map